import cron from 'node-cron';
import { processReveal, expirePendingReplays } from '../services/revealService';

// MORNING reveal at noon
cron.schedule('0 12 * * *', async () => {
  console.log('Processing MORNING reveal...');
  await processReveal('MORNING', new Date());
});

// MORNING grace period expiry at 1pm
cron.schedule('0 13 * * *', async () => {
  console.log('Expiring MORNING pending replays...');
  await expirePendingReplays('MORNING', new Date());
});

// AFTERNOON reveal at 7pm
cron.schedule('0 19 * * *', async () => {
  await processReveal('AFTERNOON', new Date());
});

// AFTERNOON grace expiry at 8pm
cron.schedule('0 20 * * *', async () => {
  await expirePendingReplays('AFTERNOON', new Date());
});

// NIGHT reveal at 11pm
cron.schedule('0 23 * * *', async () => {
  await processReveal('NIGHT', new Date());
});

// NIGHT grace expiry at midnight
cron.schedule('0 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await expirePendingReplays('NIGHT', yesterday);
});

// LATE_NIGHT reveal at 3am
cron.schedule('0 3 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await processReveal('LATE_NIGHT', yesterday);
});

// LATE_NIGHT grace expiry at 4am
cron.schedule('0 4 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await expirePendingReplays('LATE_NIGHT', yesterday);
});

console.log('Reveal worker crons registered');
