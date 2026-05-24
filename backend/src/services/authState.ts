import { randomBytes } from 'crypto';

const SPOTIFY_STATE_TTL_SECONDS = 10 * 60;
const SPOTIFY_STATE_KEY_PREFIX = 'spotify_oauth_state:';

export interface OAuthStateStore {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    seconds: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
}

function stateKey(state: string) {
  return `${SPOTIFY_STATE_KEY_PREFIX}${state}`;
}

let defaultStore: OAuthStateStore | null = null;

function getDefaultStore(): OAuthStateStore {
  if (!defaultStore) {
    defaultStore = require('./redis').default as OAuthStateStore;
  }
  return defaultStore;
}

export async function createSpotifyOAuthState(
  userId: string,
  store: OAuthStateStore = getDefaultStore(),
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = randomBytes(32).toString('base64url');
    const stored = await store.set(stateKey(state), userId, 'EX', SPOTIFY_STATE_TTL_SECONDS, 'NX');
    if (stored === 'OK') return state;
  }

  throw new Error('Could not allocate Spotify OAuth state');
}

export async function consumeSpotifyOAuthState(
  state: string,
  store: OAuthStateStore = getDefaultStore(),
): Promise<string | null> {
  const key = stateKey(state);
  const userId = await store.get(key);
  if (!userId) return null;

  await store.del(key);
  return userId;
}
