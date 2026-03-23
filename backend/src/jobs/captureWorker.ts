import dotenv from 'dotenv';
dotenv.config();

import { captureQueue } from '../services/queue';
import { executeCapture } from '../services/captureExecutor';
import './scheduleGenerator';
import './revealWorker';
import './curatorBadge';

captureQueue.process('capture', async (job) => {
  console.log(`Processing capture job ${job.id} for schedule ${job.data.scheduleId}`);
  await executeCapture(job.data.scheduleId);
});

captureQueue.on('failed', (job, err) => {
  console.error(`Capture job ${job?.id} failed:`, err);
});

captureQueue.on('completed', (job) => {
  console.log(`Capture job ${job.id} completed`);
});

console.log('Worker started: capture processor, schedule generator, reveal processor');
