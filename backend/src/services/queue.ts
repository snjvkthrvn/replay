import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const captureQueue = new Queue('captures', REDIS_URL);
export const revealQueue = new Queue('reveals', REDIS_URL);
