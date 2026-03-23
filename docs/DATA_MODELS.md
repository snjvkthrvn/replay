# Data Models — Replay

> Complete Prisma schema and database design. Ready to copy into `prisma/schema.prisma`.

---

## Entity Relationship

```
User ──1:N──▶ Replay ──1:N──▶ Reaction
                     ──1:N──▶ Comment
User ──1:N──▶ CaptureSchedule ──0:1──▶ Replay
User ◀──N:M──▶ User (via Friendship)
User ──1:N──▶ Playlist
User ──1:N──▶ DeviceToken
```

**8 tables** · One Replay per user per segment per day · Denormalized counts on Replay and User for feed performance.

---

## Complete Prisma Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─── Enums ───────────────────────────────────────────────

enum MusicService {
  SPOTIFY
  APPLE_MUSIC
}

enum Segment {
  MORNING
  AFTERNOON
  NIGHT
  LATE_NIGHT
}

enum ReplayStatus {
  PENDING
  CONFIRMED
  LATE
  SILENT
  MISSED
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  REJECTED
  BLOCKED
}

enum ExportPlatform {
  SPOTIFY
  APPLE_MUSIC
}

// ─── User ────────────────────────────────────────────────

model User {
  id                String   @id @default(uuid())

  // Identity
  email             String   @unique
  username          String   @unique
  displayName       String   @map("display_name")
  bio               String?
  profilePictureUrl String?  @map("profile_picture_url")

  // Auth
  passwordHash      String?  @map("password_hash")
  emailVerified     Boolean  @default(false) @map("email_verified")

  // Music service (Spotify / Apple Music)
  musicService        MusicService @map("music_service")
  musicServiceUserId  String       @map("music_service_user_id")
  accessToken         String       @map("access_token")       // encrypted
  refreshToken        String       @map("refresh_token")      // encrypted
  tokenExpiresAt      DateTime?    @map("token_expires_at")

  // Settings
  timezone                String @default("America/New_York")
  notificationPreferences Json   @default("{ \"capture\": true, \"reveal\": true, \"reaction\": true, \"comment\": true, \"friendRequest\": true }") @map("notification_preferences")

  // Denormalized stats
  totalReplays  Int     @default(0) @map("total_replays")
  totalFriends  Int     @default(0) @map("total_friends")
  curatorBadge  Boolean @default(false) @map("curator_badge")
  curatorStreak Int     @default(0) @map("curator_streak")

  // Timestamps
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  lastActiveAt DateTime? @map("last_active_at")

  // Relations
  replays              Replay[]
  captureSchedules     CaptureSchedule[]
  reactions            Reaction[]
  comments             Comment[]
  playlists            Playlist[]
  deviceTokens         DeviceToken[]
  friendshipsRequested Friendship[] @relation("Requester")
  friendshipsReceived  Friendship[] @relation("Addressee")

  @@unique([musicService, musicServiceUserId])
  @@map("users")
}

// ─── Replay ──────────────────────────────────────────────

model Replay {
  id     String @id @default(uuid())
  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Segment
  segment     Segment
  segmentDate DateTime @map("segment_date") @db.Date

  // Capture timing
  captureTime          DateTime  @map("capture_time")
  captureScheduledTime DateTime  @map("capture_scheduled_time")
  confirmedAt          DateTime? @map("confirmed_at")

  // Track data (from Spotify/Apple Music)
  trackName   String  @map("track_name")
  artistName  String  @map("artist_name")
  albumName   String? @map("album_name")
  albumArtUrl String? @map("album_art_url")
  trackUri    String? @map("track_uri")      // spotify:track:xxx
  externalUrl String? @map("external_url")   // open.spotify.com link

  // Status
  status          ReplayStatus @default(PENDING)
  isSilent        Boolean      @default(false) @map("is_silent")
  isLate          Boolean      @default(false) @map("is_late")
  reRollsUsed     Int          @default(0) @map("re_rolls_used")
  reRollsAvailable Int         @default(0) @map("re_rolls_available")

  // Denormalized engagement counts
  reactionCount Int @default(0) @map("reaction_count")
  commentCount  Int @default(0) @map("comment_count")

  // Timestamps
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  reactions        Reaction[]
  comments         Comment[]
  captureSchedules CaptureSchedule[]

  @@unique([userId, segmentDate, segment])
  @@index([userId, segmentDate, segment])
  @@index([segmentDate, segment, status])
  @@index([captureTime])
  @@map("replays")
}

// ─── Friendship ──────────────────────────────────────────

model Friendship {
  id          String @id @default(uuid())
  requesterId String @map("requester_id")
  requester   User   @relation("Requester", fields: [requesterId], references: [id], onDelete: Cascade)
  addresseeId String @map("addressee_id")
  addressee   User   @relation("Addressee", fields: [addresseeId], references: [id], onDelete: Cascade)

  status           FriendshipStatus @default(PENDING)
  interactionScore Int              @default(0) @map("interaction_score")

  createdAt  DateTime  @default(now()) @map("created_at")
  acceptedAt DateTime? @map("accepted_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  @@unique([requesterId, addresseeId])
  @@index([requesterId, status])
  @@index([addresseeId, status])
  @@map("friendships")
}

// ─── Reaction ────────────────────────────────────────────

model Reaction {
  id       String @id @default(uuid())
  replayId String @map("replay_id")
  replay   Replay @relation(fields: [replayId], references: [id], onDelete: Cascade)
  userId   String @map("user_id")
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  emoji String // fire, heart, laughing, music, eyes, raised_hands

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([replayId, userId])
  @@index([replayId])
  @@map("reactions")
}

// ─── Comment ─────────────────────────────────────────────

model Comment {
  id       String @id @default(uuid())
  replayId String @map("replay_id")
  replay   Replay @relation(fields: [replayId], references: [id], onDelete: Cascade)
  userId   String @map("user_id")
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  text String @db.VarChar(500)

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([replayId, createdAt])
  @@map("comments")
}

// ─── CaptureSchedule ────────────────────────────────────

model CaptureSchedule {
  id     String @id @default(uuid())
  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  segment     Segment
  segmentDate DateTime @map("segment_date") @db.Date

  scheduledCaptureTime DateTime @map("scheduled_capture_time")
  reRollsAllocated     Int      @default(0) @map("re_rolls_allocated")

  captureAttempted Boolean @default(false) @map("capture_attempted")
  captureSucceeded Boolean @default(false) @map("capture_succeeded")

  replayId String? @map("replay_id")
  replay   Replay? @relation(fields: [replayId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, segmentDate, segment])
  @@index([scheduledCaptureTime])
  @@index([userId, segmentDate])
  @@map("capture_schedules")
}

// ─── Playlist ────────────────────────────────────────────

model Playlist {
  id     String @id @default(uuid())
  userId String @map("user_id")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  name        String @db.VarChar(200)
  description String?

  // Filters used to generate
  timeRangeStart    DateTime?  @map("time_range_start") @db.Date
  timeRangeEnd      DateTime?  @map("time_range_end") @db.Date
  segmentsIncluded  Segment[]  @map("segments_included")
  friendIdsIncluded String[]   @map("friend_ids_included")

  // Export info
  exportedTo          ExportPlatform? @map("exported_to")
  externalPlaylistId  String?         @map("external_playlist_id")
  externalPlaylistUrl String?         @map("external_playlist_url")

  trackCount Int @default(0) @map("track_count")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@map("playlists")
}

// ─── DeviceToken ─────────────────────────────────────────

model DeviceToken {
  id       String @id @default(uuid())
  userId   String @map("user_id")
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  fcmToken String @map("fcm_token")
  platform String // "ios" or "android"

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([userId, fcmToken])
  @@map("device_tokens")
}
```

---

## Key Constraints

| Constraint | Purpose |
|------------|---------|
| `Replay(userId, segmentDate, segment)` UNIQUE | One capture per user per segment per day |
| `Reaction(replayId, userId)` UNIQUE | One reaction per user per capture |
| `Friendship(requesterId, addresseeId)` UNIQUE | No duplicate friend requests |
| `CaptureSchedule(userId, segmentDate, segment)` UNIQUE | One schedule entry per segment per day |
| `DeviceToken(userId, fcmToken)` UNIQUE | No duplicate device registrations |

---

## Indexes Strategy

### Feed Generation (hottest query path)

```sql
-- "Get all confirmed replays for these users on this date and segment"
-- Covered by: @@index([segmentDate, segment, status]) on replays
-- Plus: @@index([requesterId, status]) and @@index([addresseeId, status]) on friendships
```

### Capture Job Scheduling

```sql
-- "Get next capture job to fire"
-- Covered by: @@index([scheduledCaptureTime]) on capture_schedules
```

### Profile Archive

```sql
-- "Get all replays for this user, ordered by date"
-- Covered by: @@index([userId, segmentDate, segment]) on replays
```

---

## Denormalization

To avoid `COUNT(*)` queries on every feed load:

| Field | Table | Maintained By |
|-------|-------|---------------|
| `reaction_count` | replays | Increment/decrement in reaction create/delete handler |
| `comment_count` | replays | Increment/decrement in comment create/delete handler |
| `total_replays` | users | Increment on replay confirm |
| `total_friends` | users | Increment on friendship accept, decrement on unfriend |

These are maintained in application code (Prisma transactions), not database triggers, for better visibility and testability.

---

## Status Transitions

```
                    ┌─ CONFIRMED (user confirms before segment end)
                    │
PENDING ────────────┼─ LATE (user confirms during grace period)
                    │
                    ├─ MISSED (grace period expires, no action)
                    │
                    └─ SILENT (set at capture time if no music)
```

`SILENT` is set immediately at capture time — it never goes through `PENDING`.

---

## Data Lifecycle

| Table | Retention | Action |
|-------|-----------|--------|
| replays | Indefinite | Partition by month after 6 months |
| capture_schedules | 7 days | Delete old rows via daily cleanup job |
| device_tokens | Until stale | Remove tokens that fail FCM delivery |
| friendships (REJECTED) | 30 days | Delete old rejected requests |

### Volume Estimates (at 10K users)

| Table | Daily Growth | Monthly | Yearly |
|-------|-------------|---------|--------|
| replays | 40K | 1.2M | 14.6M |
| reactions | 60K | 1.8M | 21.6M |
| comments | 12K | 360K | 4.3M |
| capture_schedules | 40K (pruned weekly) | ~40K active | ~40K active |

---

## Seed Data

```sql
-- Test users
INSERT INTO users (email, username, display_name, music_service, music_service_user_id, access_token, refresh_token)
VALUES
  ('alice@test.com', 'alice', 'Alice', 'SPOTIFY', 'spotify_alice', 'fake_token', 'fake_refresh'),
  ('bob@test.com', 'bob', 'Bob', 'SPOTIFY', 'spotify_bob', 'fake_token', 'fake_refresh'),
  ('charlie@test.com', 'charlie', 'Charlie', 'SPOTIFY', 'spotify_charlie', 'fake_token', 'fake_refresh');

-- Friendship (alice ↔ bob)
INSERT INTO friendships (requester_id, addressee_id, status, accepted_at)
VALUES (
  (SELECT id FROM users WHERE username = 'alice'),
  (SELECT id FROM users WHERE username = 'bob'),
  'ACCEPTED', NOW()
);

-- Sample replay
INSERT INTO replays (user_id, segment, segment_date, capture_time, capture_scheduled_time, track_name, artist_name, album_name, status)
VALUES (
  (SELECT id FROM users WHERE username = 'alice'),
  'MORNING', CURRENT_DATE, NOW(), NOW(),
  'Good Vibrations', 'The Beach Boys', 'Pet Sounds', 'CONFIRMED'
);
```

**Test login credentials:** `alice@test.com` / `password123`, `bob@test.com` / `password123`
