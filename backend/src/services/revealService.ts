import { Segment } from '@prisma/client';
import prisma from './prisma';
import { getIO } from '../websocket';
import { sendPushNotification } from './pushNotifications';
import { SEGMENT_LABELS } from './segments';

export async function processReveal(segment: Segment, date: Date) {
  const segmentDate = new Date(date);
  segmentDate.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { musicServiceUserId: { not: 'pending' } },
  });

  for (const user of users) {
    const replay = await prisma.replay.findUnique({
      where: { userId_segmentDate_segment: { userId: user.id, segmentDate, segment } },
    });
    if (!replay) continue;

    if (replay.status === 'CONFIRMED' || replay.status === 'LATE' || replay.status === 'SILENT') {
      await sendPushNotification(user.id, {
        title: `${SEGMENT_LABELS[segment]} Replays are in!`,
        body: 'See what your friends were listening to',
        data: { type: 'reveal', segment, date: segmentDate.toISOString() },
      });
    }
  }

  // Emit to feed room
  try {
    const io = getIO();
    const dateStr = segmentDate.toISOString().split('T')[0];
    io.to(`feed:${segment}:${dateStr}`).emit('segment_revealed', {
      segment,
      date: dateStr,
      revealedAt: new Date().toISOString(),
    });
  } catch {}

  console.log(`Reveal processed for ${segment} on ${segmentDate.toISOString().split('T')[0]}`);
}

export async function expirePendingReplays(segment: Segment, date: Date) {
  const segmentDate = new Date(date);
  segmentDate.setHours(0, 0, 0, 0);

  const result = await prisma.replay.updateMany({
    where: {
      segment,
      segmentDate,
      status: 'PENDING',
    },
    data: { status: 'MISSED' },
  });

  console.log(`Expired ${result.count} pending replays for ${segment} on ${segmentDate.toISOString().split('T')[0]}`);
}
