import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// lazyConnect: don't open a TCP socket at module import time. The client
// connects on the first command. This lets unit tests that never touch Redis
// run and exit cleanly without a reconnect loop holding the event loop open.
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

export default redis;
