# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Replay** is a "BeReal for Music" mobile social app. It captures users' Spotify listening at random moments across 4 daily time segments, then reveals everyone's captures simultaneously at segment end. This repo currently contains planning and specification documents — no application code has been written yet.

## Repository Structure

This is a **documentation-only planning repo**. All files are specification docs:

- `PRODUCT_SPEC.md` — Product requirements, core mechanics, features by priority, edge cases, success metrics
- `TECHNICAL_SPEC.md` — System architecture, core services, Spotify integration, caching, security, deployment
- `API_SPEC.md` — REST endpoints and WebSocket events with request/response examples
- `DATA_MODELS.md` — Complete Prisma schema (8 tables), indexes, constraints, data lifecycle
- `DEVELOPMENT_ROADMAP.md` — 16-week phased plan with weekly task breakdowns (all tasks pending)
- `QUICK_START.md` — Dev environment setup, command reference, troubleshooting
- `STEP_BY_STEP_GUIDE.md` — Sequential implementation with working code for 38 steps
- `NEW_REPO_README.md` — Project README template for the actual code repo

## Tech Stack

**Frontend:** React Native + Expo, TypeScript, Expo Router, TanStack Query v5, NativeWind v4, Zustand
**Backend:** Node.js 20+, Express, TypeScript, Prisma, Zod, Bull (Redis-backed jobs), Socket.IO
**Database:** PostgreSQL 15+, Redis 7+
**External:** Spotify Web API (OAuth 2.0), Firebase Cloud Messaging
**Infra:** Docker + docker-compose

## Project Layout (When Code Is Created)

```
replay/
├── backend/
│   ├── src/
│   │   ├── routes/          # auth, replays, friends, reactions, comments, playlists, admin
│   │   ├── services/        # captureScheduler, captureExecutor, spotify, feedGenerator, revealService, pushNotifications, playlistService, queue, auth
│   │   ├── jobs/            # captureWorker, scheduleGenerator, revealWorker
│   │   ├── middleware/      # auth (JWT + Zod validation)
│   │   └── websocket/       # Socket.IO setup + room management
│   └── prisma/              # schema.prisma, migrations, seed.ts
├── mobile/
│   ├── app/                 # Expo Router screens (login, tabs: feed/pending/profile)
│   ├── components/          # Reusable UI
│   ├── contexts/            # AuthContext
│   ├── hooks/               # Custom hooks
│   └── services/            # api.ts, socket.ts
└── docker-compose.yml
```

## Key Commands (Once Code Exists)

### Backend
```bash
cd backend
npm run dev                              # API server with hot reload (port 3000)
npm run worker                           # Bull queue worker + cron jobs (separate process)
npm test                                 # Tests
npx prisma migrate dev --name <name>     # New migration
npx prisma generate                      # Regenerate client after schema changes
npx prisma studio                        # Database GUI (port 5555)
npx prisma db seed                       # Seed test data
```

### Mobile
```bash
cd mobile
npx expo start                           # Dev server (scan QR with Expo Go)
npx expo start --tunnel                  # Tunnel mode for physical devices
npx expo start --clear                   # Clear cache
```

## Core Domain

- **Segments:** Morning (6am–12pm), Afternoon (12pm–7pm), Night (7pm–11pm), Late Night (11pm–3am). Quiet period 3am–6am.
- **Capture:** Server picks random timestamp in segment, queries Spotify, creates Replay.
- **Re-rolls:** Weighted allocation per segment (60% → 0, 30% → 1, 10% → 2). Swaps capture for different track from listening history.
- **Reveal:** Collective unlock at segment end (12pm, 7pm, 11pm, 3am). Pre-computed feeds, push notifications.
- **Give-to-Get:** Must confirm own capture to see friends'. Prevents lurking.
- **Statuses:** PENDING → CONFIRMED / LATE (1hr grace) / MISSED / SILENT (no music).
- **Curator Badge:** 80%+ confirmation over rolling 14 days.

## Core Services

- **CaptureScheduler** — Midnight cron generates daily schedules, enqueues delayed Bull jobs
- **CaptureExecutor** — Fires at scheduled time, calls Spotify API, creates Replay, sends push
- **FeedGenerator** — Queries friends' confirmed replays, enforces give-to-get, caches in Redis (5min TTL)
- **RevealProcessor** — Cron at segment boundaries, sends reveal notifications, marks missed captures
- **WebSocket** — Rooms: `user:{id}` (personal), `feed:{segment}:{date}`. Events: `segment_revealed`, `replay_confirmed`, `reaction_added`, `comment_added`, `friend_request`

## Database (8 Tables)

`users`, `replays`, `friendships`, `reactions`, `comments`, `capture_schedules`, `playlists`, `device_tokens`. Key constraint: one Replay per user per segment per day. Denormalized counts maintained in application code (not triggers).

## Environment Variables

Backend: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, `PORT`, `NODE_ENV`
Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WS_URL`

## Implementation Approach

Follow `DEVELOPMENT_ROADMAP.md` phases in order. Phase 1 focuses on Morning segment only. Use `STEP_BY_STEP_GUIDE.md` for sequential implementation with code — it covers 38 steps from project init through a working app with auth, captures, feed, reactions, comments, WebSocket, push notifications, and playlists.
