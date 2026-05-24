import { Router } from 'express';
import prisma from '../services/prisma';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../services/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  spotifyCallbackSchema,
  deviceTokenSchema,
} from '../types/schemas';
import { createSpotifyOAuthState, consumeSpotifyOAuthState } from '../services/authState';
import { getAuthUrl, exchangeCode, getUserProfile } from '../services/spotify';

const router = Router();

// POST /auth/signup
router.post('/signup', asyncHandler(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const { email, username, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({ error: 'Email or username already taken', code: 'CONFLICT' });
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash: await hashPassword(password),
      musicService: 'SPOTIFY',
      musicServiceUserId: 'pending',
      accessToken: 'pending',
      refreshToken: 'pending',
    },
  });

  res.status(201).json({
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
    token: generateToken(user.id, user.username),
    refreshToken: generateRefreshToken(user.id, user.username),
  });
}));

// POST /auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
  }

  res.json({
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
    token: generateToken(user.id, user.username),
    refreshToken: generateRefreshToken(user.id, user.username),
  });
}));

// POST /auth/refresh
router.post('/refresh', asyncHandler(async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing refresh token', code: 'VALIDATION_ERROR' });
  }

  let payload: { userId: string; username: string };
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token', code: 'UNAUTHORIZED' });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true },
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid refresh token', code: 'UNAUTHORIZED' });
  }

  res.json({
    token: generateToken(user.id, user.username),
    refreshToken: generateRefreshToken(user.id, user.username),
  });
}));

// POST /auth/spotify - initiate OAuth
router.post('/spotify', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const state = await createSpotifyOAuthState(req.user!.userId);
  res.json({ authUrl: getAuthUrl(state) });
}));

// POST /auth/spotify/callback - complete OAuth
router.post('/spotify/callback', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = spotifyCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing code', code: 'VALIDATION_ERROR' });
  }

  const stateUserId = await consumeSpotifyOAuthState(parsed.data.state);
  if (stateUserId !== req.user!.userId) {
    return res.status(400).json({ error: 'Invalid OAuth state', code: 'VALIDATION_ERROR' });
  }

  const tokens = await exchangeCode(parsed.data.code);
  const profile = await getUserProfile(tokens.accessToken);

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      musicServiceUserId: profile.spotifyUserId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  });

  res.json({
    user: { id: user.id, username: user.username, musicService: user.musicService, musicServiceUserId: user.musicServiceUserId },
    token: generateToken(user.id, user.username),
    refreshToken: generateRefreshToken(user.id, user.username),
  });
}));

// POST /auth/device-token
router.post('/device-token', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = deviceTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
  }

  const { fcmToken, platform } = parsed.data;
  await prisma.deviceToken.upsert({
    where: { userId_fcmToken: { userId: req.user!.userId, fcmToken } },
    create: { userId: req.user!.userId, fcmToken, platform },
    update: { platform },
  });

  res.json({ message: 'Device token registered' });
}));

export default router;
