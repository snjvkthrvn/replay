import { Router } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { reactionSchema } from '../types/schemas';
import { getIO } from '../websocket';
import { sendPushNotification } from '../services/pushNotifications';

const router = Router();

// POST /reactions/:replayId
router.post('/:replayId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid emoji', code: 'VALIDATION_ERROR' });
  }

  const replayId = req.params.replayId as string;
  const userId = req.user!.userId;

  const replay = await prisma.replay.findUnique({ where: { id: replayId } });
  if (!replay) return res.status(404).json({ error: 'Replay not found', code: 'NOT_FOUND' });

  const existing = await prisma.reaction.findUnique({
    where: { replayId_userId: { replayId, userId } },
  });
  if (existing) return res.status(400).json({ error: 'Already reacted', code: 'VALIDATION_ERROR' });

  const reaction = await prisma.reaction.create({
    data: { replayId, userId, emoji: parsed.data.emoji },
    include: { user: { select: { username: true, displayName: true } } },
  });

  await prisma.replay.update({
    where: { id: replayId },
    data: { reactionCount: { increment: 1 } },
  });

  // Emit WebSocket event to replay owner
  try {
    const io = getIO();
    io.to(`user:${replay.userId}`).emit('reaction_added', {
      replayId,
      reaction: { user: reaction.user, emoji: reaction.emoji },
    });
  } catch {}

  // Send push notification to replay owner (skip self-reaction)
  if (replay.userId !== userId) {
    sendPushNotification(replay.userId, {
      title: 'New Reaction',
      body: `${reaction.user.displayName} reacted ${parsed.data.emoji} to your replay`,
      data: { type: 'reaction', replayId },
    }).catch(() => {});
  }

  res.status(201).json(reaction);
}));

// DELETE /reactions/:replayId
router.delete('/:replayId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const replayId = req.params.replayId as string;
  const userId = req.user!.userId;

  const existing = await prisma.reaction.findUnique({
    where: { replayId_userId: { replayId, userId } },
  });
  if (!existing) return res.status(404).json({ error: 'No reaction found', code: 'NOT_FOUND' });

  await prisma.reaction.delete({
    where: { replayId_userId: { replayId, userId } },
  });

  await prisma.replay.update({
    where: { id: replayId },
    data: { reactionCount: { decrement: 1 } },
  });

  res.status(204).send();
}));

export default router;
