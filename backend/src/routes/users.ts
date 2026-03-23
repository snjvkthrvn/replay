import { Router } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { updateProfileSchema } from '../types/schemas';

const router = Router();

// GET /users/me
router.get('/me', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      bio: true,
      profilePictureUrl: true,
      musicService: true,
      musicServiceUserId: true,
      timezone: true,
      notificationPreferences: true,
      totalReplays: true,
      totalFriends: true,
      curatorBadge: true,
      curatorStreak: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  res.json(user);
}));

// PATCH /users/me
router.patch('/me', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: parsed.data,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      bio: true,
      profilePictureUrl: true,
      musicService: true,
      timezone: true,
      notificationPreferences: true,
      totalReplays: true,
      totalFriends: true,
      curatorBadge: true,
      curatorStreak: true,
      createdAt: true,
    },
  });

  res.json(user);
}));

// GET /users/search?q=alice
router.get('/search', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 1) {
    return res.status(400).json({ error: 'Query parameter q is required', code: 'VALIDATION_ERROR' });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
      id: { not: req.user!.userId },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profilePictureUrl: true,
    },
    take: 20,
  });

  // Check friendship status for each result
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: req.user!.userId, addresseeId: { in: users.map(u => u.id) } },
        { addresseeId: req.user!.userId, requesterId: { in: users.map(u => u.id) } },
      ],
    },
  });

  const friendMap = new Map(friendships.map(f => {
    const friendId = f.requesterId === req.user!.userId ? f.addresseeId : f.requesterId;
    return [friendId, f.status === 'ACCEPTED'];
  }));

  res.json({
    users: users.map(u => ({
      ...u,
      isFriend: friendMap.get(u.id) || false,
    })),
  });
}));

export default router;
