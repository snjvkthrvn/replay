import { Segment } from '@prisma/client';
import prisma from './prisma';
import { getIO } from '../websocket';
import { sendPushNotification } from './pushNotifications';
import { getDueSegmentExpirations, getDueSegmentReveals, SEGMENT_LABELS } from './segments';
import { feedRoom } from '../websocket/rooms';

const USER_BATCH_SIZE = 500;

async function forEachActiveUserBatch(
  callback: (users: Array<{ id: string; timezone: string }>) => Promise<void>,
) {
  let cursor: string | undefined;

  while (true) {
    const users = await prisma.user.findMany({
      where: { musicServiceUserId: { not: 'pending' } },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
      take: USER_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;

    await callback(users);
    cursor = users[users.length - 1].id;
    if (users.length < USER_BATCH_SIZE) break;
  }
}

function workKey(segment: Segment, segmentDate: Date) {
  return `${segment}:${segmentDate.toISOString()}`;
}

async function processDueSegmentWork(
  now: Date,
  lookbackMs: number,
  dueForUser: (now: Date, timeZone: string, lookbackMs: number) => Array<{ segment: Segment; segmentDate: Date }>,
  processor: (segment: Segment, segmentDate: Date, userIds: string[]) => Promise<void>,
) {
  let processed = 0;

  await forEachActiveUserBatch(async (users) => {
    const grouped = new Map<string, { segment: Segment; segmentDate: Date; userIds: string[] }>();

    for (const user of users) {
      const due = dueForUser(now, user.timezone, lookbackMs);
      for (const item of due) {
        const key = workKey(item.segment, item.segmentDate);
        const group = grouped.get(key) || { ...item, userIds: [] };
        group.userIds.push(user.id);
        grouped.set(key, group);
      }
    }

    for (const item of grouped.values()) {
      await processor(item.segment, item.segmentDate, item.userIds);
      processed += item.userIds.length;
    }
  });

  return processed;
}

export async function processDueReveals(now = new Date(), lookbackMs = 15 * 60 * 1000) {
  return processDueSegmentWork(now, lookbackMs, getDueSegmentReveals, processReveal);
}

export async function expireDuePendingReplays(now = new Date(), lookbackMs = 15 * 60 * 1000) {
  return processDueSegmentWork(now, lookbackMs, getDueSegmentExpirations, expirePendingReplays);
}

export async function processReveal(segment: Segment, date: Date, userIds?: string[]) {
  const segmentDate = new Date(date);
  segmentDate.setUTCHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: {
      musicServiceUserId: { not: 'pending' },
      ...(userIds?.length ? { id: { in: userIds } } : {}),
    },
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
    const payload = {
      segment,
      date: dateStr,
      revealedAt: new Date().toISOString(),
    };
    users.forEach((user) => io.to(feedRoom(user.id, segment, dateStr)).emit('segment_revealed', payload));
  } catch {}

  console.log(`Reveal processed for ${segment} on ${segmentDate.toISOString().split('T')[0]}`);
}

export async function expirePendingReplays(segment: Segment, date: Date, userIds?: string[]) {
  const segmentDate = new Date(date);
  segmentDate.setUTCHours(0, 0, 0, 0);

  const result = await prisma.replay.updateMany({
    where: {
      segment,
      segmentDate,
      status: 'PENDING',
      ...(userIds?.length ? { userId: { in: userIds } } : {}),
    },
    data: { status: 'MISSED' },
  });

  console.log(`Expired ${result.count} pending replays for ${segment} on ${segmentDate.toISOString().split('T')[0]}`);
}
