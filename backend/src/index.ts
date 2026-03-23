import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Prisma } from '@prisma/client';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import replayRoutes from './routes/replays';
import friendRoutes from './routes/friends';
import reactionRoutes from './routes/reactions';
import commentRoutes from './routes/comments';
import playlistRoutes from './routes/playlists';
import adminRoutes from './routes/admin';
import { setupWebSocket } from './websocket';
import { AppError } from './middleware/AppError';

dotenv.config();

// ─── Sentry (must init before anything else) ─────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

// ─── Env validation ───────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET === 'replace-with-a-real-secret-in-production') {
  console.error('JWT_SECRET is still the placeholder value — set a real secret.');
  process.exit(1);
}

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Needed for Expo/React Native web
}));

// CORS — locked to allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8081')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl in dev)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search limiter (prevents enumeration)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many search requests.', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);
app.use('/users/search', searchLimiter);
app.use('/api', apiLimiter); // fallback for any /api prefix routes

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/replays', replayRoutes);
app.use('/friends', friendRoutes);
app.use('/reactions', reactionRoutes);
app.use('/comments', commentRoutes);
app.use('/playlists', playlistRoutes);
app.use('/admin', adminRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: 'CORS policy violation', code: 'FORBIDDEN' });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate record', code: 'CONFLICT' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
    }
    return res.status(400).json({ error: 'Database error', code: 'DATABASE_ERROR' });
  }

  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const httpServer = createServer(app);
setupWebSocket(httpServer);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

export { app, httpServer };
