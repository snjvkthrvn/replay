import cron from 'node-cron';
import { generateAllSchedules } from '../services/captureScheduler';
import { withLeaderLock } from '../services/leaderLock';

// Generate each user's local-day schedules shortly after their local midnight.
cron.schedule('0 * * * *', async () => {
  const ran = await withLeaderLock('schedule-generator-hourly', async () => {
    console.log('Running daily schedule generation...');
    await generateAllSchedules(new Date());
  }, 15 * 60); // 15-minute lock; longer than the run takes, shorter than the 1-hour interval
  if (ran === null) {
    console.log('Schedule generation skipped (another worker holds the lock)');
  }
});

console.log('Schedule generator cron registered (hourly timezone-aware, leader-locked)');
