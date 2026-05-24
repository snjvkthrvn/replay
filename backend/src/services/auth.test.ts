import { strict as assert } from 'node:assert';
import test from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-with-enough-entropy';

test('refresh tokens are accepted only by verifyRefreshToken', async () => {
  const { generateRefreshToken, verifyRefreshToken, verifyToken } = await import('./auth');

  const refreshToken = generateRefreshToken('user-1', 'alice');

  assert.deepEqual(verifyRefreshToken(refreshToken), { userId: 'user-1', username: 'alice' });
  assert.throws(() => verifyToken(refreshToken), /Invalid access token/);
});
