import cron from 'node-cron';
import { generateAllSchedules } from '../services/captureScheduler';

// Generate daily schedules at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily schedule generation...');
  await generateAllSchedules(new Date());
});

console.log('Schedule generator cron registered (midnight daily)');
