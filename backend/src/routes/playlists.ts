import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { generatePlaylist, exportToSpotify } from '../services/playlistService';
import { playlistCreateSchema } from '../types/schemas';

const router = Router();

// POST /playlists
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = playlistCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const result = await generatePlaylist(req.user!.userId, {
    name: parsed.data.name,
    description: parsed.data.description,
    timeRangeStart: parsed.data.timeRangeStart,
    timeRangeEnd: parsed.data.timeRangeEnd,
    segments: parsed.data.segmentsIncluded,
    friendIds: parsed.data.friendIdsIncluded,
  });
  res.status(201).json(result);
}));

// POST /playlists/:id/export
router.post('/:id/export', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.platform !== 'SPOTIFY') {
    return res.status(400).json({ error: 'Only Spotify supported', code: 'VALIDATION_ERROR' });
  }
  const result = await exportToSpotify(req.user!.userId, req.params.id as string);
  res.json(result);
}));

export default router;
