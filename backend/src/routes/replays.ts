import { Router } from 'express';
import { Segment } from '@prisma/client';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { getSegmentWindow, isInGracePeriod, getRevealTime } from '../services/segments';
import { getRecentlyPlayed } from '../services/spotify';
import { generateFeed, invalidateFeedCache } from '../services/feedGenerator';
import { getIO } from '../websocket';

const router = Router();

// GET /replays/pending
router.get('/pending', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const replay = await prisma.replay.findFirst({
    where: { userId: req.user!.userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  if (!replay) {
    return res.status(404).json({ error: 'No pending capture', code: 'NOT_FOUND' });
  }

  const revealTime = getRevealTime(replay.segment, replay.segmentDate);

  res.json({
    segment: replay.segment,
    replay: {
      id: replay.id,
      trackName: replay.trackName,
      artistName: replay.artistName,
      albumName: replay.albumName,
      albumArtUrl: replay.albumArtUrl,
      captureTime: replay.captureTime,
      reRollsAvailable: replay.reRollsAvailable,
      reRollsUsed: replay.reRollsUsed,
    },
    segmentEndsAt: revealTime,
  });
}));

// POST /replays/:id/confirm
router.post('/:id/confirm', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const replay = await prisma.replay.findUnique({ where: { id } });
  if (!replay) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  if (replay.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  if (replay.status !== 'PENDING') return res.status(400).json({ error: 'Already confirmed', code: 'VALIDATION_ERROR' });

  // Check if in grace period (after reveal time) -> mark as LATE
  const gracePeriod = isInGracePeriod(replay.segment, replay.segmentDate);
  const status = gracePeriod ? 'LATE' : 'CONFIRMED';

  const updated = await prisma.replay.update({
    where: { id },
    data: {
      status,
      confirmedAt: new Date(),
      isLate: gracePeriod,
    },
  });

  await prisma.user.update({
    where: { id: req.user!.userId },
    data: { totalReplays: { increment: 1 } },
  });

  // Invalidate feed cache for friends
  invalidateFeedCache(req.user!.userId).catch(() => {});

  // Emit WebSocket event
  try {
    const io = getIO();
    const dateStr = replay.segmentDate.toISOString().split('T')[0];
    io.to(`feed:${replay.segment}:${dateStr}`).emit('replay_confirmed', {
      segment: replay.segment,
      date: dateStr,
      replay: {
        id: updated.id,
        user: { id: req.user!.userId, username: req.user!.username },
        trackName: updated.trackName,
        albumArtUrl: updated.albumArtUrl,
      },
    });
  } catch {}

  res.json({ id: updated.id, status: updated.status, confirmedAt: updated.confirmedAt });
}));

// POST /replays/:id/reroll
router.post('/:id/reroll', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const replay = await prisma.replay.findUnique({ where: { id } });
  if (!replay) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  if (replay.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  if (replay.status !== 'PENDING') return res.status(400).json({ error: 'Can only re-roll pending captures', code: 'VALIDATION_ERROR' });
  if (replay.reRollsUsed >= replay.reRollsAvailable) {
    return res.status(400).json({ error: 'No re-rolls available', code: 'VALIDATION_ERROR' });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
  const { start, end } = getSegmentWindow(replay.segment, replay.segmentDate);

  const history = await getRecentlyPlayed(user.accessToken, start, end);
  const candidates = history.filter((t: any) => t.trackUri !== replay.trackUri);
  if (candidates.length === 0) {
    return res.status(400).json({ error: 'No other tracks in this segment', code: 'VALIDATION_ERROR' });
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const updated = await prisma.replay.update({
    where: { id },
    data: {
      trackName: pick.trackName,
      artistName: pick.artistName,
      albumName: pick.albumName,
      albumArtUrl: pick.albumArtUrl,
      trackUri: pick.trackUri,
      externalUrl: pick.externalUrl,
      captureTime: pick.playedAt,
      reRollsUsed: replay.reRollsUsed + 1,
    },
  });

  res.json({
    id: updated.id,
    trackName: updated.trackName,
    artistName: updated.artistName,
    albumArtUrl: updated.albumArtUrl,
    captureTime: updated.captureTime,
    reRollsUsed: updated.reRollsUsed,
    reRollsAvailable: updated.reRollsAvailable,
  });
}));

// GET /replays/feed
router.get('/feed', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const segment = req.query.segment as string;
  const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const date = new Date(dateStr + 'T00:00:00.000Z');

  if (!segment) {
    return res.status(400).json({ error: 'segment is required', code: 'VALIDATION_ERROR' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
  const cursor = req.query.cursor as string | undefined;

  const revealTime = getRevealTime(segment as Segment, date);
  const isRevealed = new Date() >= revealTime;

  const feedResult = await generateFeed(userId, segment as Segment, date, limit, cursor);

  if (feedResult.locked) {
    return res.json({
      segment,
      date: dateStr,
      revealTime,
      isRevealed,
      locked: true,
      message: `Confirm your ${segment.replace('_', ' ')} Replay to unlock`,
      friendCount: feedResult.friendCount,
    });
  }

  const { userReplay, friendReplays, hasMore, nextCursor } = feedResult;

  res.json({
    segment,
    date: dateStr,
    revealTime,
    isRevealed,
    pagination: { hasMore, nextCursor },
    userReplay: userReplay ? {
      id: userReplay.id,
      trackName: userReplay.trackName,
      artistName: userReplay.artistName,
      albumArtUrl: userReplay.albumArtUrl,
      status: userReplay.status,
      reRollsUsed: userReplay.reRollsUsed,
      reactionCount: userReplay.reactionCount,
      commentCount: userReplay.commentCount,
    } : null,
    friendReplays: (friendReplays || []).map((r: any) => ({
      id: r.id,
      user: r.user,
      trackName: r.trackName,
      artistName: r.artistName,
      albumName: r.albumName,
      albumArtUrl: r.albumArtUrl,
      captureTime: r.captureTime,
      status: r.status,
      reRollsUsed: r.reRollsUsed,
      reactionCount: r.reactionCount,
      commentCount: r.commentCount,
    })),
  });
}));

// GET /replays/:id
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const replay = await prisma.replay.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
      reactions: {
        include: { user: { select: { username: true, displayName: true } } },
      },
      comments: {
        include: { user: { select: { username: true, displayName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      },
    },
  });

  if (!replay) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

  res.json(replay);
}));

export default router;
