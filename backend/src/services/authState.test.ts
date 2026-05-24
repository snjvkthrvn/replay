import { strict as assert } from 'node:assert';
import test from 'node:test';

import { consumeSpotifyOAuthState, createSpotifyOAuthState } from './authState';

class MemoryStateStore {
  values = new Map<string, string>();

  async set(key: string, value: string, expiryMode: string, seconds: number, setMode: string) {
    assert.equal(expiryMode, 'EX');
    assert.equal(seconds, 10 * 60);
    assert.equal(setMode, 'NX');
    if (this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0;
  }
}

test('Spotify OAuth state is opaque and consumed once', async () => {
  const store = new MemoryStateStore();

  const state = await createSpotifyOAuthState('user-1', store);

  assert.notEqual(state, 'user-1');
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(await consumeSpotifyOAuthState(state, store), 'user-1');
  assert.equal(await consumeSpotifyOAuthState(state, store), null);
});

test('missing Spotify OAuth state is rejected', async () => {
  const store = new MemoryStateStore();

  assert.equal(await consumeSpotifyOAuthState('missing-state', store), null);
});
