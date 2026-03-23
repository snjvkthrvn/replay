import { Router } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { adminGuard } from '../middleware/adminGuard';
import { generateDailySchedule } from '../services/captureScheduler';
import { executeCapture } from '../services/captureExecutor';
import { processReveal, expirePendingReplays } from '../services/revealService';
import { Segment } from '@prisma/client';

const router = Router();

// POST /admin/generate-schedule
router.post('/generate-schedule', authenticate, adminGuard, asyncHandler(async (req: AuthRequest, res) => {
  await generateDailySchedule(req.user!.userId, new Date());
  res.json({ message: 'Schedule generated successfully' });
}));

// POST /admin/trigger-capture
router.post('/trigger-capture', authenticate, adminGuard, asyncHandler(async (req: AuthRequest, res) => {
  const schedule = await prisma.captureSchedule.findFirst({
    where: {
      userId: req.user!.userId,
      captureAttempted: false,
    },
    orderBy: { scheduledCaptureTime: 'asc' },
  });

  if (!schedule) {
    return res.status(404).json({ error: 'No pending schedules found' });
  }

  const replay = await executeCapture(schedule.id);
  res.json({ message: 'Capture triggered', replay });
}));

// POST /admin/trigger-reveal
router.post('/trigger-reveal', authenticate, adminGuard, asyncHandler(async (req: AuthRequest, res) => {
  const segment = (req.body.segment as Segment) || 'MORNING';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await processReveal(segment, today);
  res.json({ message: `Reveal processed for ${segment}` });
}));

// POST /admin/expire-pending
router.post('/expire-pending', authenticate, adminGuard, asyncHandler(async (req: AuthRequest, res) => {
  const segment = (req.body.segment as Segment) || 'MORNING';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await expirePendingReplays(segment, today);
  res.json({ message: `Expired pending replays for ${segment}` });
}));

export default router;
