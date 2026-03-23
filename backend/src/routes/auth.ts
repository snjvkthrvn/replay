import { Router } from 'express';
import prisma from '../services/prisma';
import { hashPassword, comparePassword, generateToken, verifyToken } from '../services/auth';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { signupSchema, loginSchema, spotifyCallbackSchema, deviceTokenSchema } from '../types/schemas';
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
  });
}));

// POST /auth/refresh
router.post('/refresh', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const token = generateToken(req.user!.userId, req.user!.username);
  res.json({ token });
}));

// POST /auth/spotify - initiate OAuth
router.post('/spotify', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  res.json({ authUrl: getAuthUrl(req.user!.userId) });
}));

// POST /auth/spotify/callback - complete OAuth
router.post('/spotify/callback', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const parsed = spotifyCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing code', code: 'VALIDATION_ERROR' });
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
