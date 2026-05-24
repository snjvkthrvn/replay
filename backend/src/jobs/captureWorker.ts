import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import { initSentry, Sentry } from '../services/observability';
import { captureQueue } from '../services/queue';
import { executeCapture } from '../services/captureExecutor';
import './scheduleGenerator';
import './revealWorker';
import './curatorBadge';

initSentry();

captureQueue.process('capture', async (job) => {
  console.log(`Processing capture job ${job.id} for schedule ${job.data.scheduleId}`);
  await executeCapture(job.data.scheduleId);
});

captureQueue.on('failed', (job, err) => {
  Sentry.captureException(err, { extra: { jobId: job?.id, scheduleId: job?.data?.scheduleId } });
  console.error(`Capture job ${job?.id} failed:`, err);
});

captureQueue.on('completed', (job) => {
  console.log(`Capture job ${job.id} completed`);
});

// Heartbeat: touch a file every 30s so an external healthcheck can detect liveness.
// Picked over an HTTP endpoint because the worker has no HTTP server — and starting
// one just for healthchecks would couple unrelated concerns.
const HEARTBEAT_FILE = process.env.WORKER_HEARTBEAT_FILE;
if (HEARTBEAT_FILE) {
  const touch = () => {
    const now = new Date();
    fs.utimes(HEARTBEAT_FILE, now, now, (err) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        fs.writeFile(HEARTBEAT_FILE, '', () => {});
      }
    });
  };
  touch();
  setInterval(touch, 30_000).unref();
}

console.log('Worker started: capture processor, schedule generator, reveal processor');
