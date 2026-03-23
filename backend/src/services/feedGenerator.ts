import { Segment } from '@prisma/client';
import prisma from './prisma';
import redis from './redis';

const FEED_TTL = 300; // 5 minutes

function feedCacheKey(userId: string, segment: Segment, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  return `feed:${userId}:${segment}:${dateStr}`;
}

export async function generateFeed(
  userId: string,
  segment: Segment,
  date: Date,
  limit = 30,
  cursor?: string,
) {
  // Check give-to-get
  const userReplay = await prisma.replay.findUnique({
    where: { userId_segmentDate_segment: { userId, segmentDate: date, segment } },
  });

  if (!userReplay || userReplay.status === 'PENDING' || userReplay.status === 'MISSED') {
    const friendCount = await prisma.friendship.count({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { addresseeId: userId, status: 'ACCEPTED' },
        ],
      },
    });
    return { locked: true, friendCount };
  }

  // Try Redis cache for friend replays
  const cacheKey = feedCacheKey(userId, segment, date);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const friendReplays = JSON.parse(cached);
      return { locked: false, userReplay, friendReplays };
    }
  } catch {}

  // Get friend IDs
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { addresseeId: userId, status: 'ACCEPTED' },
      ],
    },
  });
  const friendIds = friendships.map(f =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );

  // Get friends' confirmed replays (paginated)
  const friendReplays = await prisma.replay.findMany({
    where: {
      userId: { in: friendIds },
      segment,
      segmentDate: date,
      status: { in: ['CONFIRMED', 'LATE', 'SILENT'] },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
    },
    orderBy: { captureTime: 'asc' },
    take: limit + 1, // fetch one extra to determine if there's a next page
  });

  const hasMore = friendReplays.length > limit;
  const page = hasMore ? friendReplays.slice(0, limit) : friendReplays;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  // Cache the result (only cache first page)
  if (!cursor) {
    try {
      await redis.setex(cacheKey, FEED_TTL, JSON.stringify(page));
    } catch {}
  }

  return { locked: false, userReplay, friendReplays: page, hasMore, nextCursor };
}

export async function invalidateFeedCache(userId: string) {
  try {
    // Get all friends of this user
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { addresseeId: userId, status: 'ACCEPTED' },
        ],
      },
    });
    const friendIds = friendships.map(f =>
      f.requesterId === userId ? f.addresseeId : f.requesterId
    );

    // Delete feed cache keys for all friends
    const dateStr = new Date().toISOString().split('T')[0];
    const segments: Segment[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];
    const keys = friendIds.flatMap(fid =>
      segments.map(seg => `feed:${fid}:${seg}:${dateStr}`)
    );

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {}
}
