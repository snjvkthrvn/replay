import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { generatePlaylist, exportToSpotify } from '../services/playlistService';

const router = Router();

// POST /playlists
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const result = await generatePlaylist(req.user!.userId, {
    name: req.body.name,
    description: req.body.description,
    timeRangeStart: new Date(req.body.timeRangeStart),
    timeRangeEnd: new Date(req.body.timeRangeEnd),
    segments: req.body.segmentsIncluded,
    friendIds: req.body.friendIdsIncluded,
  });
  res.status(201).json(result);
}));

// POST /playlists/:id/export
router.post('/:id/export', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.platform !== 'SPOTIFY') {
    return res.status(400).json({ error: 'Only Spotify supported', code: 'VALIDATION_ERROR' });
  }
  const result = await exportToSpotify(req.params.id as string);
  res.json(result);
}));

export default router;
