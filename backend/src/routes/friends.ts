import { Router } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { friendRequestSchema } from '../types/schemas';
import { getIO } from '../websocket';

const router = Router();

// GET /friends
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const status = (req.query.status as string) || 'ACCEPTED';

  if (status === 'PENDING') {
    // Show incoming pending requests
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      friends: requests.map(f => ({
        friendshipId: f.id,
        ...f.requester,
        friendshipStatus: f.status,
        createdAt: f.createdAt,
      })),
    });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { addresseeId: userId, status: 'ACCEPTED' },
      ],
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
      addressee: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
    },
    take: limit + 1,
    orderBy: { acceptedAt: 'desc' },
  });

  const hasMore = friendships.length > limit;
  const page = hasMore ? friendships.slice(0, limit) : friendships;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  res.json({
    pagination: { hasMore, nextCursor },
    friends: page.map(f => ({
      friendshipId: f.id,
      ...(f.requesterId === userId ? f.addressee : f.requester),
      friendshipStatus: f.status,
      friendsSince: f.acceptedAt,
    })),
  });
}));

// POST /friends/requests
router.post('/requests', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = friendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const userId = req.user!.userId;
  const addressee = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!addressee) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  if (addressee.id === userId) return res.status(400).json({ error: 'Cannot friend yourself', code: 'VALIDATION_ERROR' });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: addressee.id },
        { requesterId: addressee.id, addresseeId: userId },
      ],
    },
  });
  if (existing) return res.status(409).json({ error: 'Friendship already exists', code: 'CONFLICT' });

  const friendship = await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: addressee.id },
    include: { addressee: { select: { username: true, displayName: true } } },
  });

  // Emit WebSocket event
  try {
    const io = getIO();
    io.to(`user:${addressee.id}`).emit('friend_request', {
      requestId: friendship.id,
      requester: { username: req.user!.username, displayName: req.user!.username },
    });
  } catch {}

  res.status(201).json({
    id: friendship.id,
    status: friendship.status,
    addressee: friendship.addressee,
  });
}));

// POST /friends/requests/:id/accept
router.post('/requests/:id/accept', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  if (friendship.addresseeId !== req.user!.userId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }
  if (friendship.status !== 'PENDING') {
    return res.status(400).json({ error: 'Request already handled', code: 'VALIDATION_ERROR' });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  // Update friend counts for both users
  await prisma.user.updateMany({
    where: { id: { in: [friendship.requesterId, friendship.addresseeId] } },
    data: { totalFriends: { increment: 1 } },
  });

  res.json({ id: updated.id, status: updated.status, acceptedAt: updated.acceptedAt });
}));

// POST /friends/requests/:id/reject
router.post('/requests/:id/reject', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  if (friendship.addresseeId !== req.user!.userId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  res.json({ id: updated.id, status: updated.status });
}));

// DELETE /friends/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

  const userId = req.user!.userId;
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  await prisma.friendship.delete({ where: { id } });
  await prisma.user.updateMany({
    where: { id: { in: [friendship.requesterId, friendship.addresseeId] } },
    data: { totalFriends: { decrement: 1 } },
  });

  res.status(204).send();
}));

export default router;
