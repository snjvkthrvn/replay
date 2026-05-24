# CLAUDE.md

This file provides guidance to coding agents working in this repository.

## Project Overview

Replay is a "BeReal for Music" mobile social app. It captures users' Spotify listening at random moments across four daily time segments, then reveals everyone's captures simultaneously at segment end.

This repo now contains production code plus planning docs:

- `backend/` - Node 20, Express, TypeScript, Prisma, Bull, Socket.IO
- `mobile/` - Expo Router React Native app with TypeScript
- `docs/` - product, API, data-model, roadmap, and implementation reference docs
- `docker-compose.yml` / `docker-compose.prod.yml` - local and production service wiring

Treat the implemented code, tests, and runtime config as the source of truth. The docs are useful design context, but some older examples may be stale.

## Tech Stack

Frontend: React Native + Expo, TypeScript, Expo Router, TanStack Query, NativeWind/Zustand references in docs.
Backend: Node.js 20+, Express, TypeScript, Prisma, Zod, Bull, Socket.IO.
Database: PostgreSQL 15+, Redis 7+.
External: Spotify Web API OAuth, Firebase Cloud Messaging HTTP v1, Sentry.
Infra: Docker and docker compose.

## Project Layout

```text
replay/
  backend/
    src/
      routes/       auth, replays, friends, reactions, comments, playlists, admin
      services/     capture, access control, Spotify, feed, reveal, push, playlist, auth
      jobs/         capture worker, schedule generator, reveal worker, curator badge
      middleware/   auth, admin guard, async errors
      websocket/    Socket.IO setup and room helpers
    prisma/         schema, migrations, seed
  mobile/
    app/            Expo Router screens
    components/     reusable UI
    contexts/       auth context
    services/       API, socket, storage, config
  docs/
```

## Key Commands

Backend:

```bash
cd backend
npm test
npm run build
npm run dev
npm run worker
npx prisma migrate dev --name <name>
npx prisma generate
npx prisma studio
```

Mobile:

```bash
cd mobile
npx tsc --noEmit
npx expo start
npx expo start --tunnel
npx expo start --clear
```

On this Windows machine, use a repo-local npm cache when `C:` is low on space:

```powershell
$env:npm_config_cache='D:\replay\npm-cache'
```

`npm-cache/`, `backend/npm-cache/`, and `mobile/npm-cache/` are ignored.

## Core Domain

- Segments: Morning 6am-12pm, Afternoon 12pm-7pm, Night 7pm-11pm, Late Night 11pm-3am. Quiet period is 3am-6am.
- Capture: server picks a random timestamp in a segment, queries Spotify, creates a Replay.
- Re-rolls: weighted allocation per segment.
- Reveal: collective unlock at segment end in each user's timezone.
- Give-to-get: users must confirm their own capture for a segment before seeing friends' replays for that segment.
- Statuses: PENDING, CONFIRMED, LATE, MISSED, SILENT.
- Curator badge: based on confirmation rate over a rolling window.

## Production Hardening Notes

- Do not bypass access-control helpers for replay detail, comments, reactions, playlist generation/export, or WebSocket feed rooms.
- Spotify OAuth state must be opaque and single-use; do not use user ids as `state`.
- Segment dates are stored as UTC-midnight dates representing the user's local segment date. Be careful with Late Night and timezone conversions.
- Production mobile config must not use localhost or placeholder public URLs.
- Package-level audits are valid from `backend/` and `mobile/`; the repo root has no package lock.

## Implementation Approach

Use `DEVELOPMENT_ROADMAP.md`, `TECHNICAL_SPEC.md`, and `STEP_BY_STEP_GUIDE.md` as context, not as authoritative runtime truth. Before declaring production readiness, rerun backend tests/build, mobile typecheck, package-level production audits, and a focused privacy/timezone/config review.
