# Step-by-Step Implementation Guide — Replay

> Sequential implementation from empty directory to working app. Follow in order.

---

## Part 1: Project Setup (Steps 1–6)

### Step 1: Initialize Backend

```bash
mkdir replay && cd replay
mkdir backend && cd backend
npm init -y
npm install express typescript ts-node-dev @types/node @types/express
npm install prisma @prisma/client
npm install dotenv jsonwebtoken bcryptjs zod axios
npm install @types/jsonwebtoken @types/bcryptjs
npx tsc --init
mkdir -p src/{routes,services,middleware,jobs,websocket,types}
```

Create `src/index.ts`:
```typescript
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Add scripts to `package.json`:
```json
{
  "scripts": {
    "dev": "ts-node-dev src/index.ts",
    "worker": "ts-node src/jobs/captureWorker.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

### Step 2: Start Postgres + Redis

```bash
docker run --name replay-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=replay -p 5432:5432 -d postgres:15-alpine
docker run --name replay-redis -p 6379:6379 -d redis:7-alpine
```

---

### Step 3: Create Prisma Schema

```bash
npx prisma init
```

Create `backend/.env`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/replay
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-real-secret
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
PORT=3000
NODE_ENV=development
```

Replace `prisma/schema.prisma` with the full schema from [DATA_MODELS.md](DATA_MODELS.md). The complete Prisma schema is defined there and should be copied directly.

---

### Step 4: Run First Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

Verify: `npx prisma studio` opens database GUI at http://localhost:5555

---

### Step 5: Install Remaining Dependencies

```bash
npm install bull @types/bull ioredis       # Job queue
npm install socket.io                       # WebSocket
npm install firebase-admin                  # Push notifications
npm install node-cron @types/node-cron      # Cron scheduling
```

---

### Step 6: Verify Setup

```bash
npm run dev
curl http://localhost:3000/health  # {"status":"ok"}
```

---

## Part 2: Authentication (Steps 7–12)

### Step 7: Auth Utilities

Create `src/services/auth.ts`:
```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string; username: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
}
```

---

### Step 8: Auth Middleware

Create `src/middleware/auth.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth';

export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided', code: 'UNAUTHORIZED' });
  }

  try {
    req.user = verifyToken(header.substring(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  }
}
```

---

### Step 9: Signup + Login Endpoints

Create `src/routes/auth.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { hashPassword, comparePassword, generateToken } from '../services/auth';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100),
});

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });

  const { email, username, password, displayName } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) return res.status(409).json({ error: 'Email or username already taken', code: 'CONFLICT' });

  const user = await prisma.user.create({
    data: {
      email, username, displayName,
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
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' });
  }

  res.json({
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
    token: generateToken(user.id, user.username),
  });
});

export default router;
```

Register in `src/index.ts`:
```typescript
import authRoutes from './routes/auth';
app.use('/auth', authRoutes);
```

---

### Step 10: Spotify OAuth Service

Create `src/services/spotify.ts`:
```typescript
import axios from 'axios';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;
const AUTH_HEADER = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`;

const SCOPES = ['user-read-currently-playing', 'user-read-recently-played', 'playlist-modify-public', 'playlist-modify-private'];

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '), state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code: string) {
  const { data } = await axios.post('https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
    { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export async function refreshToken(refreshToken: string) {
  const { data } = await axios.post('https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { headers: { Authorization: AUTH_HEADER, 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getUserProfile(accessToken: string) {
  const { data } = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { spotifyUserId: data.id, displayName: data.display_name, email: data.email };
}

export async function getCurrentlyPlaying(accessToken: string) {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!data?.item) return null;
    return {
      trackName: data.item.name,
      artistName: data.item.artists[0].name,
      albumName: data.item.album.name,
      albumArtUrl: data.item.album.images[0]?.url,
      trackUri: data.item.uri,
      externalUrl: data.item.external_urls.spotify,
    };
  } catch {
    return null;
  }
}

export async function getRecentlyPlayed(accessToken: string, after: Date, before: Date) {
  try {
    const { data } = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 50, after: after.getTime() },
    });
    return data.items
      .filter((item: any) => {
        const playedAt = new Date(item.played_at);
        return playedAt >= after && playedAt <= before;
      })
      .map((item: any) => ({
        trackName: item.track.name,
        artistName: item.track.artists[0].name,
        albumName: item.track.album.name,
        albumArtUrl: item.track.album.images[0]?.url,
        trackUri: item.track.uri,
        externalUrl: item.track.external_urls.spotify,
        playedAt: new Date(item.played_at),
      }));
  } catch {
    return [];
  }
}
```

---

### Step 11: Spotify OAuth Endpoints

Add to `src/routes/auth.ts`:
```typescript
import { getAuthUrl, exchangeCode, getUserProfile } from '../services/spotify';

router.post('/spotify', authenticate, async (req: AuthRequest, res) => {
  res.json({ authUrl: getAuthUrl(req.user!.userId) });
});

router.get('/spotify/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const tokens = await exchangeCode(code as string);
  const profile = await getUserProfile(tokens.accessToken);

  const user = await prisma.user.update({
    where: { id: state as string },
    data: {
      musicServiceUserId: profile.spotifyUserId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    },
  });

  res.json({ message: 'Spotify connected', user: { id: user.id, username: user.username, musicService: user.musicService } });
});
```

---

### Step 12: Device Token Registration

Add to `src/routes/auth.ts`:
```typescript
router.post('/device-token', authenticate, async (req: AuthRequest, res) => {
  const { fcmToken, platform } = req.body;
  await prisma.deviceToken.upsert({
    where: { userId_fcmToken: { userId: req.user!.userId, fcmToken } },
    create: { userId: req.user!.userId, fcmToken, platform },
    update: { platform },
  });
  res.json({ message: 'Device token registered' });
});
```

---

## Part 3: Capture System (Steps 13–18)

### Step 13: Job Queue Setup

Create `src/services/queue.ts`:
```typescript
import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const captureQueue = new Queue('captures', REDIS_URL);
export const revealQueue = new Queue('reveals', REDIS_URL);
```

---

### Step 14: Capture Scheduler

Create `src/services/captureScheduler.ts`:
```typescript
import { PrismaClient, Segment } from '@prisma/client';
import { captureQueue } from './queue';

const prisma = new PrismaClient();

const SEGMENT_HOURS: Record<Segment, { start: number; end: number }> = {
  MORNING: { start: 6, end: 12 },
  AFTERNOON: { start: 12, end: 19 },
  NIGHT: { start: 19, end: 23 },
  LATE_NIGHT: { start: 23, end: 27 }, // 23:00 to 03:00 next day
};

function randomTimeBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function allocateReRolls(): number {
  const r = Math.random();
  if (r < 0.6) return 0;
  if (r < 0.9) return 1;
  return 2;
}

export async function generateDailySchedule(userId: string, date: Date) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const segments: Segment[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

  for (const segment of segments) {
    const { start, end } = SEGMENT_HOURS[segment];
    const startDate = new Date(date);
    startDate.setHours(start, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(end, 0, 0, 0);

    const captureTime = randomTimeBetween(startDate, endDate);
    const reRolls = allocateReRolls();

    const schedule = await prisma.captureSchedule.create({
      data: { userId, segment, segmentDate: date, scheduledCaptureTime: captureTime, reRollsAllocated: reRolls },
    });

    const delay = captureTime.getTime() - Date.now();
    if (delay > 0) {
      await captureQueue.add('capture', { scheduleId: schedule.id }, { delay });
    }
  }
}
```

---

### Step 15: Capture Executor

Create `src/services/captureExecutor.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import { getCurrentlyPlaying } from './spotify';

const prisma = new PrismaClient();

export async function executeCapture(scheduleId: string) {
  const schedule = await prisma.captureSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: { user: true },
  });

  await prisma.captureSchedule.update({ where: { id: scheduleId }, data: { captureAttempted: true } });

  const track = await getCurrentlyPlaying(schedule.user.accessToken);

  const replay = await prisma.replay.create({
    data: {
      userId: schedule.userId,
      segment: schedule.segment,
      segmentDate: schedule.segmentDate,
      captureTime: new Date(),
      captureScheduledTime: schedule.scheduledCaptureTime,
      reRollsAvailable: schedule.reRollsAllocated,
      ...(track
        ? { trackName: track.trackName, artistName: track.artistName, albumName: track.albumName, albumArtUrl: track.albumArtUrl, trackUri: track.trackUri, externalUrl: track.externalUrl }
        : { trackName: 'Silent', artistName: 'Not listening', status: 'SILENT', isSilent: true }
      ),
    },
  });

  await prisma.captureSchedule.update({
    where: { id: scheduleId },
    data: { captureSucceeded: true, replayId: replay.id },
  });

  // TODO: Send push notification (Step 20)
}
```

---

### Step 16: Capture Worker

Create `src/jobs/captureWorker.ts`:
```typescript
import { captureQueue } from '../services/queue';
import { executeCapture } from '../services/captureExecutor';

captureQueue.process('capture', async (job) => {
  await executeCapture(job.data.scheduleId);
});

captureQueue.on('failed', (job, err) => {
  console.error(`Capture job ${job?.id} failed:`, err);
});

console.log('Capture worker started');
```

---

### Step 17: Daily Schedule Cron

Create `src/jobs/scheduleGenerator.ts`:
```typescript
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { generateDailySchedule } from '../services/captureScheduler';

const prisma = new PrismaClient();

// Midnight daily
cron.schedule('0 0 * * *', async () => {
  const users = await prisma.user.findMany({
    where: { musicServiceUserId: { not: 'pending' } },
  });
  const today = new Date();
  for (const user of users) {
    try {
      await generateDailySchedule(user.id, today);
    } catch (err) {
      console.error(`Schedule generation failed for ${user.id}:`, err);
    }
  }
  console.log(`Generated schedules for ${users.length} users`);
});
```

Import in worker: add `import './scheduleGenerator';` to `src/jobs/captureWorker.ts`.

---

### Step 18: Admin Endpoint (Dev Testing)

Create `src/routes/admin.ts`:
```typescript
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateDailySchedule } from '../services/captureScheduler';

const router = Router();

router.post('/generate-schedule', authenticate, async (req: AuthRequest, res) => {
  await generateDailySchedule(req.user!.userId, new Date());
  res.json({ message: 'Schedule generated' });
});

export default router;
```

Register: `app.use('/admin', adminRoutes);`

---

## Part 4: Replays + Friends + Feed (Steps 19–23)

### Step 19: Replay Endpoints

Create `src/routes/replays.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get pending capture
router.get('/pending', authenticate, async (req: AuthRequest, res) => {
  const replay = await prisma.replay.findFirst({
    where: { userId: req.user!.userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (!replay) return res.status(404).json({ error: 'No pending capture' });

  res.json({
    segment: replay.segment,
    replay: {
      id: replay.id, trackName: replay.trackName, artistName: replay.artistName,
      albumName: replay.albumName, albumArtUrl: replay.albumArtUrl,
      captureTime: replay.captureTime, reRollsAvailable: replay.reRollsAvailable, reRollsUsed: replay.reRollsUsed,
    },
  });
});

// Confirm capture
router.post('/:id/confirm', authenticate, async (req: AuthRequest, res) => {
  const replay = await prisma.replay.findUnique({ where: { id: req.params.id } });
  if (!replay) return res.status(404).json({ error: 'Not found' });
  if (replay.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });
  if (replay.status !== 'PENDING') return res.status(400).json({ error: 'Already confirmed' });

  const updated = await prisma.replay.update({
    where: { id: req.params.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  });
  await prisma.user.update({ where: { id: req.user!.userId }, data: { totalReplays: { increment: 1 } } });

  res.json({ id: updated.id, status: updated.status, confirmedAt: updated.confirmedAt });
});

// Re-roll capture
router.post('/:id/reroll', authenticate, async (req: AuthRequest, res) => {
  const replay = await prisma.replay.findUnique({ where: { id: req.params.id } });
  if (!replay) return res.status(404).json({ error: 'Not found' });
  if (replay.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });
  if (replay.status !== 'PENDING') return res.status(400).json({ error: 'Can only re-roll pending captures' });
  if (replay.reRollsUsed >= replay.reRollsAvailable) return res.status(400).json({ error: 'No re-rolls available' });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });

  // Get segment time window
  const windows = { MORNING: { start: 6, end: 12 }, AFTERNOON: { start: 12, end: 19 }, NIGHT: { start: 19, end: 23 }, LATE_NIGHT: { start: 23, end: 27 } };
  const w = windows[replay.segment];
  const startDate = new Date(replay.segmentDate); startDate.setHours(w.start, 0, 0, 0);
  const endDate = new Date(replay.segmentDate); endDate.setHours(w.end, 0, 0, 0);

  const { getRecentlyPlayed } = await import('../services/spotify');
  const history = await getRecentlyPlayed(user.accessToken, startDate, endDate);
  const candidates = history.filter(t => t.trackUri !== replay.trackUri);
  if (candidates.length === 0) return res.status(400).json({ error: 'No other tracks in this segment' });

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const updated = await prisma.replay.update({
    where: { id: req.params.id },
    data: {
      trackName: pick.trackName, artistName: pick.artistName, albumName: pick.albumName,
      albumArtUrl: pick.albumArtUrl, trackUri: pick.trackUri, externalUrl: pick.externalUrl,
      captureTime: pick.playedAt, reRollsUsed: replay.reRollsUsed + 1,
    },
  });

  res.json({
    id: updated.id, trackName: updated.trackName, artistName: updated.artistName,
    albumArtUrl: updated.albumArtUrl, captureTime: updated.captureTime,
    reRollsUsed: updated.reRollsUsed, reRollsAvailable: updated.reRollsAvailable,
  });
});

export default router;
```

Register: `app.use('/replays', replayRoutes);`

---

### Step 20: Push Notifications

Create `src/services/pushNotifications.ts`:
```typescript
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

// Initialize Firebase (place service account JSON in backend root)
const serviceAccount = require(path.join(__dirname, '../../firebase-service-account.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

export async function sendPushNotification(userId: string, payload: { title: string; body: string; data?: Record<string, string> }) {
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  await admin.messaging().sendEachForMulticast({
    tokens: tokens.map(t => t.fcmToken),
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    apns: { payload: { aps: { sound: 'default' } } },
  });
}
```

Update `src/services/captureExecutor.ts` — add after creating replay:
```typescript
import { sendPushNotification } from './pushNotifications';
// After creating replay:
await sendPushNotification(schedule.userId, {
  title: 'Captured!',
  body: track ? `${track.trackName} — ${track.artistName}` : 'Silent Replay',
  data: { type: 'capture', replayId: replay.id, segment: replay.segment },
});
```

---

### Step 21: Friend System

Create `src/routes/friends.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// List friends
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const status = (req.query.status as string) || 'ACCEPTED';

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId, status }, { addresseeId: userId, status }] },
    include: {
      requester: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
      addressee: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } },
    },
  });

  res.json({
    friends: friendships.map(f => ({
      ...(f.requesterId === userId ? f.addressee : f.requester),
      friendshipStatus: f.status,
      friendsSince: f.acceptedAt,
    })),
  });
});

// Send friend request
router.post('/requests', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const addressee = await prisma.user.findUnique({ where: { username: req.body.username } });
  if (!addressee) return res.status(404).json({ error: 'User not found' });
  if (addressee.id === userId) return res.status(400).json({ error: 'Cannot friend yourself' });

  const existing = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: userId, addresseeId: addressee.id }, { requesterId: addressee.id, addresseeId: userId }] },
  });
  if (existing) return res.status(409).json({ error: 'Friendship already exists' });

  const friendship = await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: addressee.id },
    include: { addressee: { select: { username: true, displayName: true } } },
  });

  res.status(201).json({ id: friendship.id, status: friendship.status, addressee: friendship.addressee });
});

// Accept friend request
router.post('/requests/:id/accept', authenticate, async (req: AuthRequest, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship) return res.status(404).json({ error: 'Not found' });
  if (friendship.addresseeId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });

  const updated = await prisma.friendship.update({
    where: { id: req.params.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  await prisma.user.updateMany({
    where: { id: { in: [friendship.requesterId, friendship.addresseeId] } },
    data: { totalFriends: { increment: 1 } },
  });

  res.json({ id: updated.id, status: updated.status, acceptedAt: updated.acceptedAt });
});

// Reject friend request
router.post('/requests/:id/reject', authenticate, async (req: AuthRequest, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship) return res.status(404).json({ error: 'Not found' });
  if (friendship.addresseeId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });

  const updated = await prisma.friendship.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
  res.json({ id: updated.id, status: updated.status });
});

// Unfriend
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const friendship = await prisma.friendship.findUnique({ where: { id: req.params.id } });
  if (!friendship) return res.status(404).json({ error: 'Not found' });

  const userId = req.user!.userId;
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  await prisma.friendship.delete({ where: { id: req.params.id } });
  await prisma.user.updateMany({
    where: { id: { in: [friendship.requesterId, friendship.addresseeId] } },
    data: { totalFriends: { decrement: 1 } },
  });

  res.status(204).send();
});

export default router;
```

Register: `app.use('/friends', friendRoutes);`

---

### Step 22: Feed Endpoint

Add to `src/routes/replays.ts`:
```typescript
router.get('/feed', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;
  const segment = req.query.segment as string;
  const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const date = new Date(dateStr);

  if (!segment) return res.status(400).json({ error: 'segment is required' });

  // Check give-to-get
  const userReplay = await prisma.replay.findUnique({
    where: { userId_segmentDate_segment: { userId, segmentDate: date, segment: segment as any } },
  });

  if (!userReplay || userReplay.status === 'PENDING') {
    const friendCount = await prisma.friendship.count({
      where: { OR: [{ requesterId: userId, status: 'ACCEPTED' }, { addresseeId: userId, status: 'ACCEPTED' }] },
    });
    return res.json({ segment, date: dateStr, locked: true, message: 'Confirm your Replay to unlock', friendCount });
  }

  // Get friend IDs
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId, status: 'ACCEPTED' }, { addresseeId: userId, status: 'ACCEPTED' }] },
  });
  const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);

  // Get friends' replays
  const friendReplays = await prisma.replay.findMany({
    where: { userId: { in: friendIds }, segment: segment as any, segmentDate: date, status: { in: ['CONFIRMED', 'LATE', 'SILENT'] } },
    include: { user: { select: { id: true, username: true, displayName: true, profilePictureUrl: true } } },
    orderBy: { captureTime: 'asc' },
  });

  res.json({ segment, date: dateStr, isRevealed: true, userReplay, friendReplays });
});
```

---

### Step 23: Test End-to-End

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Worker
npm run worker

# Terminal 3: Test
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"tester","password":"password123","displayName":"Test User"}'

# Save the token from the response, then:
curl -X POST http://localhost:3000/admin/generate-schedule \
  -H "Authorization: Bearer YOUR_TOKEN"

curl http://localhost:3000/replays/pending \
  -H "Authorization: Bearer YOUR_TOKEN"

# (After capture fires or you create a manual replay in Prisma Studio)
curl -X POST http://localhost:3000/replays/REPLAY_ID/confirm \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:3000/replays/feed?segment=MORNING" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Part 5: Social Features (Steps 24–27)

### Step 24: Reactions

Create `src/routes/reactions.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const ALLOWED_EMOJIS = ['fire', 'heart', 'laughing', 'music', 'eyes', 'raised_hands'];

router.post('/:replayId', authenticate, async (req: AuthRequest, res) => {
  const { replayId } = req.params;
  const { emoji } = req.body;
  const userId = req.user!.userId;

  if (!ALLOWED_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Invalid emoji' });

  const existing = await prisma.reaction.findUnique({ where: { replayId_userId: { replayId, userId } } });
  if (existing) return res.status(400).json({ error: 'Already reacted' });

  const reaction = await prisma.reaction.create({
    data: { replayId, userId, emoji },
    include: { user: { select: { username: true, displayName: true } } },
  });
  await prisma.replay.update({ where: { id: replayId }, data: { reactionCount: { increment: 1 } } });

  res.status(201).json(reaction);
});

router.delete('/:replayId', authenticate, async (req: AuthRequest, res) => {
  const { replayId } = req.params;
  await prisma.reaction.delete({ where: { replayId_userId: { replayId, userId: req.user!.userId } } });
  await prisma.replay.update({ where: { id: replayId }, data: { reactionCount: { decrement: 1 } } });
  res.status(204).send();
});

export default router;
```

Register: `app.use('/reactions', reactionRoutes);`

---

### Step 25: Comments

Create `src/routes/comments.ts`:
```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/:replayId', authenticate, async (req: AuthRequest, res) => {
  const { text } = req.body;
  if (!text || text.length > 500) return res.status(400).json({ error: 'Text required (max 500 chars)' });

  const comment = await prisma.comment.create({
    data: { replayId: req.params.replayId, userId: req.user!.userId, text },
    include: { user: { select: { username: true, displayName: true } } },
  });
  await prisma.replay.update({ where: { id: req.params.replayId }, data: { commentCount: { increment: 1 } } });

  res.status(201).json(comment);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.userId !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });

  await prisma.comment.delete({ where: { id: req.params.id } });
  await prisma.replay.update({ where: { id: comment.replayId }, data: { commentCount: { decrement: 1 } } });
  res.status(204).send();
});

export default router;
```

Register: `app.use('/comments', commentRoutes);`

---

### Step 26: WebSocket Server

Create `src/websocket/index.ts`:
```typescript
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../services/auth';

let ioInstance: Server;

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    try {
      const user = verifyToken(socket.handshake.auth.token);
      socket.data.userId = user.userId;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on('join_feed', ({ segment, date }) => socket.join(`feed:${segment}:${date}`));
    socket.on('leave_feed', ({ segment, date }) => socket.leave(`feed:${segment}:${date}`));
  });

  ioInstance = io;
  return io;
}

export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket.IO not initialized');
  return ioInstance;
}
```

Update `src/index.ts` to use HTTP server:
```typescript
import { createServer } from 'http';
import { setupWebSocket } from './websocket';

const httpServer = createServer(app);
setupWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

Then add WebSocket emissions to reactions, comments, and confirm endpoints by importing `getIO()` and emitting to the relevant rooms. See [API_SPEC.md](API_SPEC.md) for the event payloads.

---

### Step 27: Reveal Service

Create `src/services/revealService.ts`:
```typescript
import { PrismaClient, Segment } from '@prisma/client';
import { getIO } from '../websocket';
import { sendPushNotification } from './pushNotifications';

const prisma = new PrismaClient();

const SEGMENT_LABELS: Record<Segment, string> = {
  MORNING: 'Morning', AFTERNOON: 'Afternoon', NIGHT: 'Night', LATE_NIGHT: 'Late Night',
};

export async function processReveal(segment: Segment, date: Date) {
  const users = await prisma.user.findMany({ where: { musicServiceUserId: { not: 'pending' } } });

  for (const user of users) {
    const replay = await prisma.replay.findUnique({
      where: { userId_segmentDate_segment: { userId: user.id, segmentDate: date, segment } },
    });
    if (!replay) continue;

    if (replay.status === 'CONFIRMED' || replay.status === 'LATE') {
      await sendPushNotification(user.id, {
        title: `${SEGMENT_LABELS[segment]} Replays are in!`,
        body: 'See what your friends were listening to',
        data: { type: 'reveal', segment, date: date.toISOString() },
      });
      getIO().to(`user:${user.id}`).emit('segment_revealed', { segment, date });
    } else if (replay.status === 'PENDING') {
      await prisma.replay.update({ where: { id: replay.id }, data: { status: 'MISSED' } });
    }
  }
}
```

Create `src/jobs/revealWorker.ts`:
```typescript
import cron from 'node-cron';
import { processReveal } from '../services/revealService';

cron.schedule('0 12 * * *', () => processReveal('MORNING', new Date()));
cron.schedule('0 19 * * *', () => processReveal('AFTERNOON', new Date()));
cron.schedule('0 23 * * *', () => processReveal('NIGHT', new Date()));
cron.schedule('0 3 * * *', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  processReveal('LATE_NIGHT', yesterday);
});
```

Import in worker: add `import './revealWorker';` to `src/jobs/captureWorker.ts`.

---

## Part 6: Mobile App (Steps 28–35)

### Step 28: Initialize Expo Project

```bash
cd ..  # Back to replay root
npx create-expo-app mobile --template blank-typescript
cd mobile
npm install @tanstack/react-query axios socket.io-client expo-secure-store
npx expo install expo-router react-native-safe-area-context react-native-screens
```

Create `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=http://localhost:3000
```

---

### Step 29: API Client

Create `mobile/services/api.ts`:
```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const api = axios.create({ baseURL: process.env.EXPO_PUBLIC_API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const signup = async (data: { email: string; username: string; password: string; displayName: string }) => {
  const res = await api.post('/auth/signup', data);
  await SecureStore.setItemAsync('authToken', res.data.token);
  return res.data;
};

export const login = async (email: string, password: string) => {
  const res = await api.post('/auth/login', { email, password });
  await SecureStore.setItemAsync('authToken', res.data.token);
  return res.data;
};

export const getPendingReplay = () => api.get('/replays/pending').then(r => r.data);
export const confirmReplay = (id: string) => api.post(`/replays/${id}/confirm`).then(r => r.data);
export const rerollReplay = (id: string) => api.post(`/replays/${id}/reroll`).then(r => r.data);
export const getFeed = (segment: string, date?: string) => {
  const params = new URLSearchParams({ segment }); if (date) params.append('date', date);
  return api.get(`/replays/feed?${params}`).then(r => r.data);
};

export default api;
```

---

### Step 30: Auth Context

Create `mobile/contexts/AuthContext.tsx`:
```typescript
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { login as apiLogin, signup as apiSignup } from '../services/api';

interface User { id: string; username: string; displayName: string; email: string }
interface AuthCtx { user: User | null; isLoading: boolean; login: (e: string, p: string) => Promise<void>; signup: (d: any) => Promise<void>; logout: () => Promise<void> }

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { SecureStore.getItemAsync('authToken').then(t => { if (t) setUser({ id: '', username: '', displayName: '', email: '' }); setIsLoading(false); }); }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login: async (e, p) => { const d = await apiLogin(e, p); setUser(d.user); },
      signup: async (data) => { const d = await apiSignup(data); setUser(d.user); },
      logout: async () => { await SecureStore.deleteItemAsync('authToken'); setUser(null); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => { const c = useContext(AuthContext); if (!c) throw new Error('useAuth requires AuthProvider'); return c; };
```

---

### Step 31: Socket Client

Create `mobile/services/socket.ts`:
```typescript
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

let socket: Socket | null = null;

export async function connectSocket() {
  const token = await SecureStore.getItemAsync('authToken');
  if (!token) return;
  socket = io(process.env.EXPO_PUBLIC_WS_URL!, { auth: { token } });
  return socket;
}

export function disconnectSocket() { socket?.disconnect(); socket = null; }
export function getSocket() { return socket; }
export function joinFeed(segment: string, date: string) { socket?.emit('join_feed', { segment, date }); }
```

---

### Step 32: App Layout

Create `mobile/app/_layout.tsx`:
```typescript
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

Create `mobile/app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="pending" options={{ title: 'Capture' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
```

---

### Step 33: Login Screen

Create `mobile/app/login.tsx`:
```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Replay</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Login" onPress={async () => { try { await login(email, password); router.replace('/(tabs)'); } catch (e: any) { setError(e.response?.data?.error || 'Login failed'); } }} />
      <Button title="Sign Up" onPress={() => router.push('/signup')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 },
  error: { color: 'red', marginBottom: 12 },
});
```

---

### Step 34: Feed Screen

Create `mobile/app/(tabs)/index.tsx`:
```typescript
import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getFeed } from '../../services/api';

const SEGMENTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

export default function FeedScreen() {
  const [segment, setSegment] = useState('MORNING');
  const { data, isLoading } = useQuery({ queryKey: ['feed', segment], queryFn: () => getFeed(segment) });

  if (isLoading) return <View style={styles.center}><Text>Loading...</Text></View>;
  if (data?.locked) return <View style={styles.center}><Text style={styles.locked}>{data.message}</Text><Text>{data.friendCount} friends waiting</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {SEGMENTS.map(s => (
          <TouchableOpacity key={s} onPress={() => setSegment(s)} style={[styles.tab, segment === s && styles.activeTab]}>
            <Text style={segment === s ? styles.activeText : undefined}>{s.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data?.friendReplays || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.albumArtUrl }} style={styles.art} />
            <View style={styles.info}>
              <Text style={styles.username}>{item.user.displayName}</Text>
              <Text style={styles.track}>{item.trackName}</Text>
              <Text style={styles.artist}>{item.artistName}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  locked: { fontSize: 18, marginBottom: 8 },
  tabs: { flexDirection: 'row', padding: 8 },
  tab: { flex: 1, padding: 10, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#000' },
  activeText: { fontWeight: 'bold' },
  card: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  art: { width: 72, height: 72, borderRadius: 8 },
  info: { marginLeft: 14, justifyContent: 'center' },
  username: { fontWeight: 'bold', fontSize: 14 },
  track: { fontSize: 16, marginTop: 4 },
  artist: { fontSize: 14, color: '#666' },
});
```

---

### Step 35: Pending Capture Screen

Create `mobile/app/(tabs)/pending.tsx`:
```typescript
import React from 'react';
import { View, Text, Image, Button, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingReplay, confirmReplay, rerollReplay } from '../../services/api';

export default function PendingScreen() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['pending'], queryFn: getPendingReplay, retry: false });

  const confirm = useMutation({ mutationFn: confirmReplay, onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending'] }); qc.invalidateQueries({ queryKey: ['feed'] }); } });
  const reroll = useMutation({ mutationFn: rerollReplay, onSuccess: () => qc.invalidateQueries({ queryKey: ['pending'] }) });

  if (isLoading) return <View style={s.center}><Text>Loading...</Text></View>;
  if (!data?.replay) return <View style={s.center}><Text>No pending captures</Text><Text style={s.sub}>Wait for your next one!</Text></View>;

  const { replay, segment } = data;

  return (
    <View style={s.center}>
      <Text style={s.segment}>{segment} Replay</Text>
      <Image source={{ uri: replay.albumArtUrl }} style={s.art} />
      <Text style={s.track}>{replay.trackName}</Text>
      <Text style={s.artist}>{replay.artistName}</Text>
      <Text style={s.rerolls}>Re-rolls: {replay.reRollsAvailable - replay.reRollsUsed} left</Text>
      <View style={s.buttons}>
        <Button title="Confirm" onPress={() => confirm.mutate(replay.id)} />
        {replay.reRollsAvailable > replay.reRollsUsed && <Button title="Re-roll" onPress={() => reroll.mutate(replay.id)} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  segment: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  art: { width: 240, height: 240, borderRadius: 12, marginBottom: 20 },
  track: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  artist: { fontSize: 16, color: '#666', marginTop: 4 },
  sub: { color: '#999', marginTop: 8 },
  rerolls: { marginTop: 20, color: '#666' },
  buttons: { marginTop: 24, flexDirection: 'row', gap: 12 },
});
```

---

## Part 7: Playlists (Steps 36–37)

### Step 36: Playlist Service

Create `src/services/playlistService.ts`:
```typescript
import { PrismaClient, Segment } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export async function generatePlaylist(userId: string, opts: { name: string; description?: string; timeRangeStart: Date; timeRangeEnd: Date; segments?: Segment[]; friendIds?: string[] }) {
  const userIds = opts.friendIds ? [...opts.friendIds, userId] : [userId];
  const where: any = { userId: { in: userIds }, segmentDate: { gte: opts.timeRangeStart, lte: opts.timeRangeEnd }, status: { in: ['CONFIRMED', 'LATE'] }, isSilent: false };
  if (opts.segments?.length) where.segment = { in: opts.segments };

  const replays = await prisma.replay.findMany({ where, orderBy: { captureTime: 'asc' } });

  const unique = new Map<string, any>();
  for (const r of replays) if (r.trackUri && !unique.has(r.trackUri)) unique.set(r.trackUri, { trackUri: r.trackUri, trackName: r.trackName, artistName: r.artistName, albumArtUrl: r.albumArtUrl });
  const tracks = [...unique.values()];

  const playlist = await prisma.playlist.create({
    data: { userId, name: opts.name, description: opts.description, timeRangeStart: opts.timeRangeStart, timeRangeEnd: opts.timeRangeEnd, segmentsIncluded: opts.segments || [], friendIdsIncluded: opts.friendIds || [], trackCount: tracks.length },
  });

  return { id: playlist.id, name: playlist.name, trackCount: tracks.length, tracks };
}

export async function exportToSpotify(playlistId: string) {
  const playlist = await prisma.playlist.findUniqueOrThrow({ where: { id: playlistId }, include: { user: true } });
  const userIds = playlist.friendIdsIncluded.length ? [...playlist.friendIdsIncluded, playlist.userId] : [playlist.userId];

  const replays = await prisma.replay.findMany({
    where: { userId: { in: userIds }, segmentDate: { gte: playlist.timeRangeStart!, lte: playlist.timeRangeEnd! }, status: { in: ['CONFIRMED', 'LATE'] }, isSilent: false, trackUri: { not: null } },
  });
  const uris = [...new Set(replays.map(r => r.trackUri!))];

  const { data: created } = await axios.post(`https://api.spotify.com/v1/users/${playlist.user.musicServiceUserId}/playlists`,
    { name: playlist.name, description: playlist.description || 'Generated by Replay', public: false },
    { headers: { Authorization: `Bearer ${playlist.user.accessToken}` } },
  );

  // Add tracks in batches of 100
  for (let i = 0; i < uris.length; i += 100) {
    await axios.post(`https://api.spotify.com/v1/playlists/${created.id}/tracks`,
      { uris: uris.slice(i, i + 100) },
      { headers: { Authorization: `Bearer ${playlist.user.accessToken}` } },
    );
  }

  await prisma.playlist.update({ where: { id: playlistId }, data: { exportedTo: 'SPOTIFY', externalPlaylistId: created.id, externalPlaylistUrl: created.external_urls.spotify } });

  return { externalPlaylistId: created.id, externalPlaylistUrl: created.external_urls.spotify, trackCount: uris.length };
}
```

---

### Step 37: Playlist Endpoints

Create `src/routes/playlists.ts`:
```typescript
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generatePlaylist, exportToSpotify } from '../services/playlistService';

const router = Router();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const result = await generatePlaylist(req.user!.userId, {
    name: req.body.name, description: req.body.description,
    timeRangeStart: new Date(req.body.timeRangeStart), timeRangeEnd: new Date(req.body.timeRangeEnd),
    segments: req.body.segmentsIncluded, friendIds: req.body.friendIdsIncluded,
  });
  res.status(201).json(result);
});

router.post('/:id/export', authenticate, async (req: AuthRequest, res) => {
  if (req.body.platform !== 'SPOTIFY') return res.status(400).json({ error: 'Only Spotify supported' });
  res.json(await exportToSpotify(req.params.id));
});

export default router;
```

Register: `app.use('/playlists', playlistRoutes);`

---

## Part 8: Final Backend Assembly (Step 38)

### Step 38: Complete `src/index.ts`

```typescript
import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import replayRoutes from './routes/replays';
import friendRoutes from './routes/friends';
import reactionRoutes from './routes/reactions';
import commentRoutes from './routes/comments';
import playlistRoutes from './routes/playlists';
import adminRoutes from './routes/admin';
import { setupWebSocket } from './websocket';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/replays', replayRoutes);
app.use('/friends', friendRoutes);
app.use('/reactions', reactionRoutes);
app.use('/comments', commentRoutes);
app.use('/playlists', playlistRoutes);
app.use('/admin', adminRoutes);

const httpServer = createServer(app);
setupWebSocket(httpServer);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

Complete `src/jobs/captureWorker.ts`:
```typescript
import { captureQueue } from '../services/queue';
import { executeCapture } from '../services/captureExecutor';
import './scheduleGenerator';
import './revealWorker';

captureQueue.process('capture', async (job) => {
  await executeCapture(job.data.scheduleId);
});

captureQueue.on('failed', (job, err) => {
  console.error(`Capture job ${job?.id} failed:`, err);
});

console.log('Worker started: capture processor, schedule generator, reveal processor');
```

---

## What's Next

After completing these steps, the core application is functional. Continue with:

1. **Profile endpoints** — `GET /users/:username`, `GET /users/:username/archive`
2. **User search** — `GET /users/search?q=...`
3. **Curator badge cron** — Daily calculation of 14-day confirmation rate
4. **Late confirmation** — Allow confirms within 1 hour of segment end, mark as `LATE`
5. **Redis caching** — Cache feed responses with 5-minute TTL
6. **Mobile polish** — Proper styling with NativeWind, tab icons, loading states
7. **Onboarding flow** — Tutorial screens, Spotify connection prompt

See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for the complete Phase 3 and Phase 4 task lists.
