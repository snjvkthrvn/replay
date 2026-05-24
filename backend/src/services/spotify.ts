import axios from 'axios';
import prisma from './prisma';
import redis from './redis';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;
const AUTH_HEADER = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;

const SCOPES = [
  'user-read-currently-playing',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
];

// Two-level lock to prevent token-refresh races:
//   1. Process-local Map dedupes concurrent calls within one process.
//   2. Redis NX lock dedupes across processes/instances.
const refreshLocks = new Map<string, Promise<string>>();
const REFRESH_LOCK_TTL_SECONDS = 15;
const REFRESH_WAIT_MAX_MS = 10_000;
const REFRESH_WAIT_INTERVAL_MS = 100;

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string) {
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshAccessToken(refreshToken: string) {
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getUserProfile(accessToken: string) {
  const { data } = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { spotifyUserId: data.id, displayName: data.display_name, email: data.email };
}

export class SpotifyApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

// Spotify returns 204 No Content when nothing is playing — distinct from a real error.
// 401/403 mean auth failure (token revoked) — caller should mark user for re-OAuth.
// 5xx and network errors are transient — re-throw so the job queue retries.
function classifyAndRethrow(err: any, endpoint: string): never | null {
  if (err?.response?.status === 204 || err?.response?.status === 404) {
    return null;
  }
  const status = err?.response?.status as number | undefined;
  if (status && status >= 400 && status < 500) {
    // Permanent client errors — don't retry, but caller should know.
    throw new SpotifyApiError(`Spotify ${endpoint} returned ${status}`, status);
  }
  // 5xx or network error — transient.
  throw new SpotifyApiError(`Spotify ${endpoint} transient failure: ${err?.message || err}`, status);
}

export async function getCurrentlyPlaying(accessToken: string) {
  try {
    const { data, status } = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
      validateStatus: (s) => (s >= 200 && s < 300) || s === 204,
    });
    if (status === 204 || !data?.item) return null;
    return {
      trackName: data.item.name,
      artistName: data.item.artists[0].name,
      albumName: data.item.album.name,
      albumArtUrl: data.item.album.images[0]?.url,
      trackUri: data.item.uri,
      externalUrl: data.item.external_urls.spotify,
    };
  } catch (err) {
    return classifyAndRethrow(err, 'currently-playing');
  }
}

export async function getRecentlyPlayed(accessToken: string, after: Date, before: Date) {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 50, after: after.getTime() },
    });
    return (data.items || [])
      .filter((item: any) => {
        const playedAt = new Date(item.played_at);
        return playedAt >= after && playedAt <= before;
      })
      .map((item: any) => ({
        trackName: item.track.name,
        artistName: item.track.artists[0].name,
        albumName: item.track.album.name,
        albumArtUrl: item.track.album.images[0]?.url,
        trackUri: item.track.uri,
        externalUrl: item.track.external_urls.spotify,
        playedAt: new Date(item.played_at),
      }));
  } catch (err) {
    const result = classifyAndRethrow(err, 'recently-played');
    return result === null ? [] : result;
  }
}

function tokenStillFresh(expiresAt: Date | null): boolean {
  const bufferMs = 60 * 1000;
  return Boolean(expiresAt && expiresAt.getTime() - bufferMs > Date.now());
}

async function acquireRefreshLock(userId: string): Promise<boolean> {
  const acquired = await redis.set(`spotify_refresh_lock:${userId}`, '1', 'EX', REFRESH_LOCK_TTL_SECONDS, 'NX');
  return acquired === 'OK';
}

async function releaseRefreshLock(userId: string): Promise<void> {
  try {
    await redis.del(`spotify_refresh_lock:${userId}`);
  } catch (err) {
    console.error(`Failed to release Spotify refresh lock for ${userId}:`, err);
  }
}

async function waitForLockReleaseAndReread(userId: string): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < REFRESH_WAIT_MAX_MS) {
    await new Promise((r) => setTimeout(r, REFRESH_WAIT_INTERVAL_MS));
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: { accessToken: true, tokenExpiresAt: true },
    });
    if (updated && tokenStillFresh(updated.tokenExpiresAt)) {
      return updated.accessToken;
    }
  }
  throw new Error('Timed out waiting for Spotify token refresh');
}

export async function ensureValidToken(user: { id: string; accessToken: string; refreshToken: string; tokenExpiresAt: Date | null }) {
  if (tokenStillFresh(user.tokenExpiresAt)) {
    return user.accessToken;
  }

  // Process-local dedupe — multiple concurrent refreshes inside one process share one promise.
  const existing = refreshLocks.get(user.id);
  if (existing) {
    return existing;
  }

  const refreshPromise = (async () => {
    // Cross-instance dedupe — only the lock-holder calls Spotify.
    const haveLock = await acquireRefreshLock(user.id);
    if (!haveLock) {
      // Another instance is refreshing. Poll DB for the new token.
      return waitForLockReleaseAndReread(user.id);
    }

    try {
      const result = await refreshAccessToken(user.refreshToken);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: result.accessToken,
          tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        },
      });
      return result.accessToken;
    } catch {
      throw new Error('Failed to refresh Spotify token');
    } finally {
      await releaseRefreshLock(user.id);
    }
  })();

  refreshLocks.set(user.id, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    refreshLocks.delete(user.id);
  }
}
