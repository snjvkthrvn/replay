import cron from 'node-cron';
import { expireDuePendingReplays, processDueReveals } from '../services/revealService';
import { withLeaderLock } from '../services/leaderLock';

cron.schedule('*/15 * * * *', async () => {
  const ran = await withLeaderLock('reveal-worker-quarter-hour', async () => {
    const now = new Date();
    const revealed = await processDueReveals(now);
    const expired = await expireDuePendingReplays(now);
    if (revealed || expired) {
      console.log(`Processed due reveal work: ${revealed} reveal users, ${expired} expiry users`);
    }
  }, 10 * 60); // 10-minute lock; shorter than 15-min interval to avoid blocking next tick
  if (ran === null) {
    console.log('Reveal processing skipped (another worker holds the lock)');
  }
});

console.log('Reveal worker cron registered (timezone-aware every 15 minutes, leader-locked)');
