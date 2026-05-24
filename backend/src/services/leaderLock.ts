import { randomUUID } from 'crypto';
import redis from './redis';

const DEFAULT_TTL_SECONDS = 60;

// Atomically release the lock ONLY if we still own it (token matches).
// Without this guard, a slow handler could expire its lock, another worker
// grabs it, then the slow handler deletes the new owner's lock.
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export async function withLeaderLock<T>(
  name: string,
  handler: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T | null> {
  const key = `leader:${name}`;
  const token = randomUUID();

  const acquired = await redis.set(key, token, 'EX', ttlSeconds, 'NX');
  if (acquired !== 'OK') {
    return null;
  }

  try {
    return await handler();
  } finally {
    try {
      await redis.eval(RELEASE_SCRIPT, 1, key, token);
    } catch (err) {
      console.error(`Failed to release leader lock ${name}:`, err);
    }
  }
}
