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

export async function invalidateFeedCache(
  userId: string,
  segment?: Segment,
  segmentDate?: Date,
) {
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
    if (friendIds.length === 0) return;

    // Targeted invalidation: only the cache keys whose (segment, segmentDate) actually changed.
    // Cache keys are keyed by the viewer's *local segment date*, which equals the replay's segmentDate
    // (segmentDate is the user's local date, stored as UTC midnight — see segments.ts).
    let keys: string[];
    if (segment && segmentDate) {
      const dateStr = segmentDate.toISOString().split('T')[0];
      keys = friendIds.map((fid) => `feed:${fid}:${segment}:${dateStr}`);
    } else {
      // Fallback: invalidate today and yesterday, all segments — covers timezone edges
      // where the viewer's local date may be ahead of or behind the server's UTC date.
      const segments: Segment[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dateStrs = [today, yesterday].map((d) => d.toISOString().split('T')[0]);
      keys = friendIds.flatMap((fid) =>
        segments.flatMap((seg) => dateStrs.map((ds) => `feed:${fid}:${seg}:${ds}`))
      );
    }

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.error('Feed cache invalidation failed:', err);
  }
}
