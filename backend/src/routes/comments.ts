import { Router } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { commentSchema } from '../types/schemas';
import { getIO } from '../websocket';
import { sendPushNotification } from '../services/pushNotifications';

const router = Router();

// POST /comments/:replayId
router.post('/:replayId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Text required (max 500 chars)', code: 'VALIDATION_ERROR' });
  }

  const replayId = req.params.replayId as string;
  const userId = req.user!.userId;

  const replay = await prisma.replay.findUnique({ where: { id: replayId } });
  if (!replay) return res.status(404).json({ error: 'Replay not found', code: 'NOT_FOUND' });

  const comment = await prisma.comment.create({
    data: { replayId, userId, text: parsed.data.text },
    include: { user: { select: { username: true, displayName: true } } },
  });

  await prisma.replay.update({
    where: { id: replayId },
    data: { commentCount: { increment: 1 } },
  });

  // Emit WebSocket event to replay owner
  try {
    const io = getIO();
    io.to(`user:${replay.userId}`).emit('comment_added', {
      replayId,
      comment: { user: comment.user, text: comment.text },
    });
  } catch {}

  // Send push notification to replay owner (skip self-comment)
  if (replay.userId !== userId) {
    sendPushNotification(replay.userId, {
      title: 'New Comment',
      body: `${comment.user.displayName}: ${comment.text.substring(0, 50)}`,
      data: { type: 'comment', replayId },
    }).catch(() => {});
  }

  res.status(201).json(comment);
}));

// DELETE /comments/:id
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const id = req.params.id as string;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
  if (comment.userId !== req.user!.userId) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  await prisma.comment.delete({ where: { id } });
  await prisma.replay.update({
    where: { id: comment.replayId },
    data: { commentCount: { decrement: 1 } },
  });

  res.status(204).send();
}));

export default router;
