import cron from 'node-cron';
import prisma from '../services/prisma';

const MIN_ATTEMPTS = 4;
const BADGE_THRESHOLD = 0.8;
const ROLLING_DAYS = 14;

async function calculateCuratorBadges() {
  console.log('Running curator badge calculation...');

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - ROLLING_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { musicServiceUserId: { not: 'pending' } },
    select: { id: true },
  });

  let updated = 0;

  for (const user of users) {
    try {
      // Count capture schedules that were attempted in the rolling window
      const attempted = await prisma.captureSchedule.count({
        where: {
          userId: user.id,
          captureAttempted: true,
          segmentDate: { gte: cutoff },
        },
      });

      // Count confirmed/late replays in the rolling window
      const confirmed = await prisma.replay.count({
        where: {
          userId: user.id,
          status: { in: ['CONFIRMED', 'LATE'] },
          segmentDate: { gte: cutoff },
        },
      });

      const rate = attempted >= MIN_ATTEMPTS ? confirmed / attempted : 0;
      const earnsBadge = rate >= BADGE_THRESHOLD && attempted >= MIN_ATTEMPTS;

      // Calculate streak: consecutive days with at least one confirmation
      let streak = 0;
      const checkDate = new Date(now);
      checkDate.setHours(0, 0, 0, 0);

      while (true) {
        const dayConfirmed = await prisma.replay.count({
          where: {
            userId: user.id,
            status: { in: ['CONFIRMED', 'LATE'] },
            segmentDate: checkDate,
          },
        });

        if (dayConfirmed === 0) break;
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          curatorBadge: earnsBadge,
          curatorStreak: streak,
        },
      });

      updated++;
    } catch (err) {
      console.error(`Curator badge calculation failed for ${user.id}:`, err);
    }
  }

  console.log(`Curator badge calculation complete for ${updated} users`);
}

// Daily at 5am
cron.schedule('0 5 * * *', async () => {
  await calculateCuratorBadges();
});

console.log('Curator badge cron registered (5am daily)');

export { calculateCuratorBadges };
