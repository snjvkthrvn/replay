import axios from 'axios';
import prisma from './prisma';

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

// In-memory lock per userId to prevent concurrent token refresh races
const refreshLocks = new Map<string, Promise<string>>();

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

export async function getCurrentlyPlaying(accessToken: string) {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!data?.item) return null;
    return {
      trackName: data.item.name,
      artistName: data.item.artists[0].name,
      albumName: data.item.album.name,
      albumArtUrl: data.item.album.images[0]?.url,
      trackUri: data.item.uri,
      externalUrl: data.item.external_urls.spotify,
    };
  } catch {
    return null;
  }
}

export async function getRecentlyPlayed(accessToken: string, after: Date, before: Date) {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 50, after: after.getTime() },
    });
    return data.items
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
  } catch {
    return [];
  }
}

export async function ensureValidToken(user: { id: string; accessToken: string; refreshToken: string; tokenExpiresAt: Date | null }) {
  // Add 60-second buffer before expiry
  const bufferMs = 60 * 1000;
  if (user.tokenExpiresAt && user.tokenExpiresAt.getTime() - bufferMs > Date.now()) {
    return user.accessToken;
  }

  // Check if a refresh is already in progress for this user
  const existing = refreshLocks.get(user.id);
  if (existing) {
    return existing;
  }

  const refreshPromise = (async () => {
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
    } catch (err) {
      throw new Error('Failed to refresh Spotify token');
    } finally {
      refreshLocks.delete(user.id);
    }
  })();

  refreshLocks.set(user.id, refreshPromise);
  return refreshPromise;
}
