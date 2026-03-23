# Quick Start — Replay

> Go from zero to a running dev environment.

---

## Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** (for Postgres + Redis)
- **Expo CLI:** `npm install -g expo-cli`
- **Spotify Developer account** (free) at https://developer.spotify.com/dashboard

---

## 1. Set Up Spotify Credentials

Before writing any code, create a Spotify app:

1. Go to https://developer.spotify.com/dashboard → **Create App**
2. App Name: `Replay Dev`, Redirect URI: `http://localhost:3000/auth/spotify/callback`, APIs: Web API
3. Click **Settings** → copy **Client ID** and **Client Secret**

Required scopes: `user-read-currently-playing`, `user-read-recently-played`, `playlist-modify-public`, `playlist-modify-private`

---

## 2. Start Infrastructure

```bash
# Start Postgres + Redis via Docker
docker run --name replay-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=replay -p 5432:5432 -d postgres:15-alpine
docker run --name replay-redis -p 6379:6379 -d redis:7-alpine
```

Or use the project's `docker-compose.yml` once the repo is scaffolded:
```bash
docker-compose up -d
```

---

## 3. Set Up Backend

```bash
cd backend
npm install

# Create .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:password@localhost:5432/replay
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-random-secret
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/spotify/callback
PORT=3000
NODE_ENV=development
EOF

# Run database migrations
npx prisma migrate dev --name init
npx prisma generate

# (Optional) Seed test data
npx prisma db seed

# Start dev server
npm run dev
```

Backend runs on `http://localhost:3000`. Verify: `curl http://localhost:3000/health` → `{"status":"ok"}`

---

## 4. Set Up Mobile

```bash
cd mobile
npm install

# Create .env
cat > .env << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=http://localhost:3000
EOF

# Start Expo
npx expo start
```

Scan the QR code with Expo Go (iOS/Android) or press `w` for web preview.

---

## 5. Start the Worker

The capture system runs as a separate process:

```bash
cd backend
npm run worker
```

This starts the Bull queue worker that processes scheduled captures and the cron job for daily schedule generation.

---

## Verify Everything Works

```bash
# Backend health
curl http://localhost:3000/health

# Database GUI
cd backend && npx prisma studio  # Opens at http://localhost:5555

# Redis
redis-cli ping  # Returns PONG
```

---

## Daily Development

### Two terminals for backend:
```bash
# Terminal 1: API server
cd backend && npm run dev

# Terminal 2: Job worker
cd backend && npm run worker
```

### One terminal for mobile:
```bash
cd mobile && npx expo start
```

---

## Command Reference

### Backend
| Command | What |
|---------|------|
| `npm run dev` | Start dev server with hot reload |
| `npm run worker` | Start Bull queue worker + cron jobs |
| `npm test` | Run tests |
| `npm run lint` | Lint |
| `npm run format` | Format code |
| `npx prisma migrate dev --name <name>` | Create new migration |
| `npx prisma generate` | Regenerate Prisma Client |
| `npx prisma studio` | Database GUI |
| `npx prisma db seed` | Seed test data |

### Mobile
| Command | What |
|---------|------|
| `npx expo start` | Start dev server |
| `npx expo start --tunnel` | Start with tunnel (for physical devices on different network) |
| `npx expo start --clear` | Clear cache and start |
| `npx expo run:ios` | Run on iOS simulator |
| `npx expo run:android` | Run on Android emulator |
| `npm run type-check` | TypeScript check |
| `npm run lint` | Lint |

### Infrastructure
| Command | What |
|---------|------|
| `docker-compose up -d` | Start Postgres + Redis |
| `docker-compose logs -f backend` | View backend logs |
| `redis-cli FLUSHALL` | Clear Redis (cache + jobs) |

---

## Troubleshooting

### Port 3000 in use
```bash
lsof -ti:3000 | xargs kill -9
# Or change PORT in backend/.env
```

### Can't connect to Postgres
```bash
pg_isready  # Check if running
docker start replay-postgres  # If using Docker
```

### Prisma Client errors after schema change
```bash
cd backend && npx prisma generate && npm run dev
```

### Expo Go can't reach backend
Use tunnel mode: `npx expo start --tunnel`

Or find your machine's IP and update `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_IP:3000
```
Find IP: `ifconfig | grep "inet " | grep -v 127.0.0.1` (macOS/Linux)

### Spotify OAuth redirect fails
Verify that `SPOTIFY_REDIRECT_URI` in `backend/.env` exactly matches the Redirect URI in your Spotify Dashboard settings.

---

## Test Credentials (After Seeding)

| Email | Password |
|-------|----------|
| `alice@test.com` | `password123` |
| `bob@test.com` | `password123` |
| `charlie@test.com` | `password123` |

Alice and Bob are pre-connected as friends. Alice has a sample confirmed replay.
