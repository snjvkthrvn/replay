# Replay

> BeReal for music. See what your friends are *actually* listening to.

Replay captures your Spotify listening at random moments across four daily time segments, then reveals everyone's captures simultaneously. No curation — just the real soundtrack of your day.

---

## How It Works

1. **Random capture** — At a random moment in each segment, the server checks what you're playing on Spotify
2. **Confirm or re-roll** — You see your capture and can accept it or re-roll (0–2 chances, randomly allocated)
3. **Collective reveal** — When the segment ends, everyone's captures unlock at the same time
4. **Give to get** — You must confirm yours before you can see your friends' captures

### The Four Segments

| Segment | Window | Reveal |
|---------|--------|--------|
| Morning | 6 AM – 12 PM | 12 PM |
| Afternoon | 12 PM – 7 PM | 7 PM |
| Night | 7 PM – 11 PM | 11 PM |
| Late Night | 11 PM – 3 AM | 3 AM |

---

## Tech Stack

**Mobile:** React Native + Expo · TypeScript · Expo Router · TanStack Query · NativeWind
**Backend:** Node.js · Express · TypeScript · Prisma · Bull · Socket.IO
**Database:** PostgreSQL · Redis
**Integrations:** Spotify Web API · Firebase Cloud Messaging

---

## Project Structure

```
replay/
├── backend/                 # Express API + job workers
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (capture, feed, spotify, push)
│   │   ├── jobs/            # Bull workers + cron jobs
│   │   ├── middleware/      # Auth, validation
│   │   └── websocket/       # Socket.IO
│   └── prisma/              # Schema, migrations, seed
├── mobile/                  # Expo app
│   ├── app/                 # Screens (Expo Router)
│   ├── components/          # UI components
│   ├── hooks/               # React hooks
│   └── services/            # API client, auth, socket
└── docker-compose.yml
```

---

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker

# Start Postgres + Redis
docker-compose up -d

# Backend
cd backend && npm install
cp .env.example .env  # Fill in Spotify credentials
npx prisma migrate dev --name init
npm run dev       # API server on :3000
npm run worker    # Job worker (separate terminal)

# Mobile
cd mobile && npm install
npx expo start    # Scan QR with Expo Go
```

See [QUICK_START.md](QUICK_START.md) for detailed setup including Spotify credential configuration.

---

## Documentation

| Document | Contents |
|----------|----------|
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | Product requirements, user flows, features, edge cases |
| [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) | Architecture, core systems, integrations, deployment |
| [API_SPEC.md](API_SPEC.md) | REST endpoints, WebSocket events, error formats |
| [DATA_MODELS.md](DATA_MODELS.md) | Complete Prisma schema, indexes, data lifecycle |
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | 16-week phased implementation plan |
| [QUICK_START.md](QUICK_START.md) | Development environment setup |
| [STEP_BY_STEP_GUIDE.md](STEP_BY_STEP_GUIDE.md) | Sequential implementation with code |

---

## Development Phases

| Phase | Weeks | Focus |
|-------|-------|-------|
| 1 | 1–4 | Core loop (Morning segment only) |
| 2 | 5–8 | All 4 segments, re-rolls, reactions, real-time |
| 3 | 9–12 | Profiles, playlists, curator badge |
| 4 | 13–16 | Onboarding, performance, beta launch |

See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for task breakdowns.

---

## What We're NOT Building (V1)

- Public profiles or discovery algorithms
- In-app music playback
- Music recommendations
- Algorithmic feeds
- Monetization
- Desktop/web app

---

**Status:** Early development (Phase 1)
