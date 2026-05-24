import { strict as assert } from 'node:assert';
import test from 'node:test';

test('Spotify auth URL requires OAuth credentials only when used', async () => {
  const originalClientId = process.env.SPOTIFY_CLIENT_ID;
  const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const originalRedirectUri = process.env.SPOTIFY_REDIRECT_URI;
  process.env.SPOTIFY_CLIENT_ID = '';
  process.env.SPOTIFY_CLIENT_SECRET = '';
  process.env.SPOTIFY_REDIRECT_URI = '';

  try {
    const { getAuthUrl } = await import('./spotify');

    assert.throws(() => getAuthUrl('state-1'), /Spotify OAuth is not configured/);
  } finally {
    if (originalClientId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret;
    if (originalRedirectUri === undefined) delete process.env.SPOTIFY_REDIRECT_URI;
    else process.env.SPOTIFY_REDIRECT_URI = originalRedirectUri;
  }
});
