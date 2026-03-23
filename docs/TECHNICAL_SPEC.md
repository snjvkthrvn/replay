# Technical Specification — Replay

> Architecture, systems design, and implementation patterns.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                 Mobile App (React Native + Expo)          │
│   Auth Flow  ·  Feed View  ·  Capture Confirm  ·  Push   │
└──────┬──────────────┬──────────────────────┬─────────────┘
       │ REST          │ WebSocket            │ FCM
       ▼               ▼                      ▼
┌──────────────────────────────────────────────────────────┐
│                  Backend (Node.js + Express)              │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Routes  │  │ Socket.IO│  │ Bull Jobs│  │   Cron   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴─────────────┴─────────────┘       │
│                    Service Layer                          │
│  CaptureScheduler · CaptureExecutor · FeedGenerator      │
│  RevealProcessor  · SpotifyAPI      · PushNotifications   │
└──────────┬─────────────────┬────────────────┬────────────┘
           ▼                 ▼                ▼
     ┌──────────┐     ┌──────────┐     ┌──────────────┐
     │ Postgres │     │  Redis   │     │ Spotify API  │
     │ (data)   │     │ (cache/  │     │ Apple Music  │
     │          │     │  jobs)   │     │ FCM          │
     └──────────┘     └──────────┘     └──────────────┘
```

**Communication patterns:**
- Mobile → Backend: REST API for CRUD, WebSocket for real-time updates
- Backend → Mobile: WebSocket events (reactions, comments, reveals), FCM for push notifications
- Backend → Spotify: OAuth token management + REST API calls
- Backend → Redis: Feed caching, job queue (Bull), rate limiting

---

## Tech Stack

### Frontend
| Concern | Choice | Why |
|---------|--------|-----|
| Framework | React Native + Expo | Native feel, single codebase, Expo simplifies OAuth/notifications |
| Routing | Expo Router | File-based routing, familiar to Next.js developers |
| Server State | TanStack Query v5 | Cache management, optimistic updates, query invalidation on WebSocket events |
| Local State | Zustand | Lightweight, no boilerplate |
| Styling | NativeWind v4 | Tailwind CSS syntax in React Native |
| Components | React Native Paper | Material Design components as a starting point |
| Auth Storage | expo-secure-store | Encrypted token storage on device |
| Notifications | expo-notifications | Push notification handling |

### Backend
| Concern | Choice | Why |
|---------|--------|-----|
| Runtime | Node.js 20+ | Large ecosystem, good for I/O-bound work |
| Framework | Express.js | Battle-tested, minimal overhead |
| Language | TypeScript | Type safety across the stack |
| ORM | Prisma | Type-safe queries, declarative schema, painless migrations |
| Validation | Zod | Runtime type checking for request bodies |
| Job Queue | Bull | Redis-backed, supports delayed jobs and cron, retries |
| Real-time | Socket.IO | Room-based pub/sub, automatic reconnection |
| Auth | JWT (jsonwebtoken) | Stateless auth, 7-day access tokens |
| Password | bcryptjs | Cost factor 12 |
| HTTP Client | axios | For Spotify API calls |
| Cron | node-cron | Schedule generation at midnight |

### Infrastructure
| Concern | Choice | Why |
|---------|--------|-----|
| Database | PostgreSQL 15+ | ACID, JSONB, proven at scale |
| Cache/Queue | Redis 7+ | Fast KV store, Bull queue backend |
| Push | Firebase Cloud Messaging | Cross-platform, reliable delivery |
| Containers | Docker + docker-compose | Consistent dev environment |
| CI/CD | GitHub Actions | Integrated with repo |

---

## Core Systems

### 1. Capture Scheduler

Runs at midnight in each user's timezone. For each of the 4 segments, it:

1. Picks a random timestamp within the segment window
2. Allocates re-rolls (weighted: 60% → 0, 30% → 1, 10% → 2)
3. Writes a `CaptureSchedule` row
4. Enqueues a delayed Bull job that fires at the random timestamp

```typescript
// services/captureScheduler.ts
async function generateDailySchedule(userId: string, date: Date) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const segments: Segment[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

  for (const segment of segments) {
    const { start, end } = getSegmentWindow(segment, date, user.timezone);
    const captureTime = randomTimeBetween(start, end);
    const reRolls = weightedRandom([0, 1, 2], [0.6, 0.3, 0.1]);

    const schedule = await prisma.captureSchedule.create({
      data: { userId, segment, segmentDate: date, scheduledCaptureTime: captureTime, reRollsAllocated: reRolls }
    });

    const delay = captureTime.getTime() - Date.now();
    if (delay > 0) {
      await captureQueue.add('capture', { scheduleId: schedule.id }, { delay });
    }
  }
}
```

### 2. Capture Executor

When a Bull job fires, the executor:

1. Queries `GET /v1/me/player/currently-playing` on Spotify
2. If playing → creates a `PENDING` Replay with that track
3. If not playing → queries `GET /v1/me/player/recently-played` for tracks within the segment window, picks one at random
4. If no history → creates a `SILENT` Replay
5. Sends push notification: "Captured!"

Token refresh happens transparently — if the access token is expired, the executor refreshes it before making the API call and updates the stored token.

```typescript
// services/captureExecutor.ts
async function executeCapture(scheduleId: string) {
  const schedule = await prisma.captureSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: { user: true }
  });

  await prisma.captureSchedule.update({
    where: { id: scheduleId },
    data: { captureAttempted: true }
  });

  const accessToken = await ensureValidToken(schedule.user);
  const track = await spotify.getCurrentlyPlaying(accessToken)
    ?? await spotify.getRandomFromHistory(accessToken, schedule.segment, schedule.segmentDate);

  const replay = await prisma.replay.create({
    data: {
      userId: schedule.userId,
      segment: schedule.segment,
      segmentDate: schedule.segmentDate,
      captureTime: new Date(),
      captureScheduledTime: schedule.scheduledCaptureTime,
      reRollsAvailable: schedule.reRollsAllocated,
      ...(track
        ? { trackName: track.name, artistName: track.artist, albumName: track.album, albumArtUrl: track.artUrl, trackUri: track.uri, externalUrl: track.url }
        : { trackName: 'Silent', artistName: 'Not listening', status: 'SILENT', isSilent: true }
      )
    }
  });

  await prisma.captureSchedule.update({
    where: { id: scheduleId },
    data: { captureSucceeded: true, replayId: replay.id }
  });

  await pushNotification(schedule.userId, { title: 'Captured!', body: track ? `${track.name} — ${track.artist}` : 'Silent Replay' });
}
```

### 3. Reveal Processor

Runs via cron at each segment boundary (12 PM, 7 PM, 11 PM, 3 AM) for all applicable timezones:

1. Find all users whose segment just ended
2. For each user with a `CONFIRMED` Replay → pre-compute their feed, cache it, send push: "Morning Replays are in!"
3. For each user with a `PENDING` Replay → do nothing yet (grace period starts)
4. After the 1-hour grace period → mark remaining `PENDING` Replays as `MISSED`

```typescript
// jobs/revealProcessor.ts
async function processReveal(segment: Segment) {
  const timezones = getTimezonesAtSegmentEnd(segment);
  const users = await prisma.user.findMany({ where: { timezone: { in: timezones } } });
  const today = new Date();

  for (const user of users) {
    const replay = await prisma.replay.findUnique({
      where: { userId_segmentDate_segment: { userId: user.id, segmentDate: today, segment } }
    });

    if (replay?.status === 'CONFIRMED') {
      await feedGenerator.precompute(user.id, segment, today);
      await pushNotification(user.id, { title: `${segmentLabel(segment)} Replays are in!`, body: 'See what your friends were listening to' });
      io.to(`user:${user.id}`).emit('segment_revealed', { segment, date: today });
    }
  }

  // Schedule grace period expiry (1 hour later)
  await revealQueue.add('expire-pending', { segment, date: today }, { delay: 60 * 60 * 1000 });
}
```

### 4. Feed Generator

Builds the feed for a user viewing a specific segment:

1. Check give-to-get: if user hasn't confirmed → return locked response with friend count
2. Get all accepted friend IDs
3. Query friends' confirmed/late/silent Replays for that segment + date
4. Attach reaction and comment counts (denormalized on the Replay row)
5. Cache the result in Redis (5-minute TTL)
6. Invalidate cache when any friend confirms, or when a new reaction/comment is added

```
Cache key: feed:{userId}:{segment}:{date}
TTL: 5 minutes
Invalidation: on confirm, on reaction, on comment
```

### 5. WebSocket (Socket.IO)

**Rooms:**
- `user:{userId}` — Personal notifications (auto-joined on connection)
- `feed:{segment}:{date}` — Segment feed updates (joined when viewing a feed)

**Events (server → client):**

| Event | Trigger | Room | Payload |
|-------|---------|------|---------|
| `segment_revealed` | Segment ends | `feed:*` | `{ segment, date }` |
| `replay_confirmed` | Friend confirms | `feed:*` | `{ replay summary }` |
| `reaction_added` | Someone reacts to your capture | `user:*` | `{ replayId, emoji, user }` |
| `comment_added` | Someone comments on your capture | `user:*` | `{ replayId, text, user }` |
| `friend_request` | New friend request | `user:*` | `{ requestId, user }` |

**Auth:** JWT token passed in `socket.handshake.auth.token`, verified on connection.

---

## Spotify Integration

### OAuth Flow
```
App → Backend: POST /auth/spotify (get auth URL)
App → Spotify: Open auth URL in browser
Spotify → Backend: Redirect with authorization code
Backend → Spotify: Exchange code for access_token + refresh_token
Backend: Encrypt and store tokens, link Spotify user ID
```

### Required Scopes
- `user-read-currently-playing` — Capture what's playing now
- `user-read-recently-played` — Fallback to listening history
- `playlist-modify-public` — Export playlists
- `playlist-modify-private` — Export playlists

### Token Management
- Access tokens expire in 1 hour. Before every Spotify API call, check `token_expires_at`. If expired, refresh using the stored refresh token.
- Tokens are encrypted at rest with AES-256.
- If a refresh fails (user revoked access), push a notification asking to re-authenticate. Captures pause until resolved.

### Rate Limits
Spotify allows ~180 requests per minute per app (not per user). At scale:
- Batch capture jobs to avoid bursts
- Implement exponential backoff on 429 responses
- Cache listening history responses (they rarely change within minutes)

---

## Caching Strategy

| Data | Cache Key | TTL | Invalidation |
|------|-----------|-----|-------------|
| Feed | `feed:{userId}:{segment}:{date}` | 5 min | Confirm, reaction, comment |
| User profile | `user:{userId}:profile` | 1 hour | Profile update |
| Friend list | `user:{userId}:friends` | 10 min | Friendship change |
| Segment times | `segments:{timezone}` | 24 hours | Static |

---

## Security

### Authentication
- JWT access tokens (7-day expiry) stored in `expo-secure-store` on mobile, `httpOnly` cookies on web
- Refresh tokens (30-day expiry) rotated on each use
- bcrypt password hashing (cost factor 12)

### Data Protection
- Spotify OAuth tokens encrypted at rest (AES-256)
- All traffic over HTTPS/WSS
- Input validation via Zod schemas on every endpoint

### Rate Limiting
- Default: 100 requests/minute per user
- Auth endpoints: 10 requests/minute
- WebSocket connections: 5 per user
- Implemented via Redis sliding window

---

## Deployment

### Development
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment: { POSTGRES_DB: replay, POSTGRES_USER: replay, POSTGRES_PASSWORD: password }
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  backend:
    build: ./backend
    depends_on: [postgres, redis]
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://replay:password@postgres:5432/replay
      REDIS_URL: redis://redis:6379
```

### Production
- 3 backend replicas behind a load balancer
- PgBouncer for connection pooling (max 500 connections)
- Redis Cluster for high availability
- Sentry for error tracking, Prometheus + Grafana for metrics

---

## Scaling Plan

| Users | Architecture | Handles |
|-------|-------------|---------|
| 10K | Single backend, single Postgres, single Redis | 40K captures/day |
| 100K | 3–5 backend instances, Postgres read replicas, Redis Cluster | 400K captures/day |
| 1M | Microservices (Capture, Feed, Social), sharded Postgres, CDN for album art | 4M captures/day |

### Key Scaling Decisions
- **Partition `replays` table by month** after 6 months (table grows ~1.2M rows/month at 10K users)
- **Pre-compute feeds at reveal time** rather than on-demand at scale
- **Archive `capture_schedules`** after 7 days (write-heavy, not needed for reads)
