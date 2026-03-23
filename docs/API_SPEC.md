# API Specification — Replay

> REST endpoints + WebSocket events.

**Base URL:** `http://localhost:3000` (dev) · `https://api.replay.app` (prod)

All authenticated endpoints require `Authorization: Bearer <jwt>`.

---

## Auth

### `POST /auth/signup`

Create account.

```json
// Request
{ "email": "user@example.com", "username": "johndoe", "password": "securepass123", "displayName": "John Doe" }

// Response 201
{ "user": { "id": "uuid", "email": "user@example.com", "username": "johndoe", "displayName": "John Doe" }, "token": "jwt" }
```

### `POST /auth/login`

```json
// Request
{ "email": "user@example.com", "password": "securepass123" }

// Response 200
{ "user": { ... }, "token": "jwt" }
```

### `POST /auth/refresh`

Refresh an expired JWT. Requires existing token in header.

```json
// Response 200
{ "token": "new_jwt" }
```

### `POST /auth/spotify`

Initiate Spotify OAuth. Requires auth.

```json
// Request
{ "redirectUri": "replay://auth/callback" }

// Response 200
{ "authUrl": "https://accounts.spotify.com/authorize?..." }
```

### `POST /auth/spotify/callback`

Complete Spotify OAuth and link account.

```json
// Request
{ "code": "spotify_auth_code" }

// Response 200
{ "user": { "id": "uuid", "musicService": "SPOTIFY", "musicServiceUserId": "spotify_123" }, "token": "jwt" }
```

### `POST /auth/device-token`

Register FCM device token for push notifications. Requires auth.

```json
// Request
{ "fcmToken": "token_string", "platform": "ios" }

// Response 200
{ "message": "Device token registered" }
```

---

## Users

### `GET /users/me`

Current user profile. Requires auth.

```json
// Response 200
{
  "id": "uuid",
  "username": "johndoe",
  "displayName": "John Doe",
  "bio": "Music lover",
  "profilePictureUrl": "https://...",
  "musicService": "SPOTIFY",
  "timezone": "America/New_York",
  "totalReplays": 42,
  "totalFriends": 12,
  "curatorBadge": true,
  "curatorStreak": 7,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### `PATCH /users/me`

Update profile. Requires auth.

```json
// Request (all fields optional)
{
  "displayName": "John Smith",
  "bio": "New bio",
  "timezone": "America/Los_Angeles",
  "notificationPreferences": { "capture": true, "reveal": true, "reaction": false, "comment": true, "friendRequest": true }
}

// Response 200 — updated user object
```

### `GET /users/:username`

Public profile.

```json
// Response 200
{
  "username": "janedoe",
  "displayName": "Jane Doe",
  "bio": "Coffee & music",
  "profilePictureUrl": "https://...",
  "totalReplays": 38,
  "curatorBadge": false,
  "isFriend": true
}
```

### `GET /users/search?q=alice`

Search users by username or display name. Requires auth.

```json
// Response 200
{ "users": [{ "username": "alice", "displayName": "Alice", "profilePictureUrl": "https://...", "isFriend": false }] }
```

### `GET /users/:username/archive?month=2025-01`

Calendar archive of past captures. Requires auth + friendship.

```json
// Response 200
{
  "username": "alice",
  "month": "2025-01",
  "replays": [
    { "id": "uuid", "segment": "MORNING", "segmentDate": "2025-01-12", "trackName": "Blinding Lights", "artistName": "The Weeknd", "albumArtUrl": "https://..." }
  ],
  "stats": { "totalReplays": 45, "confirmationRate": 0.87, "topArtists": ["The Weeknd", "Queen", "The Beatles"] }
}
```

---

## Replays

### `GET /replays/pending`

Get current pending capture. Requires auth.

```json
// Response 200
{
  "segment": "MORNING",
  "replay": {
    "id": "uuid",
    "trackName": "Good Vibrations",
    "artistName": "The Beach Boys",
    "albumName": "Pet Sounds",
    "albumArtUrl": "https://...",
    "captureTime": "2025-01-12T08:47:00Z",
    "reRollsAvailable": 2,
    "reRollsUsed": 0
  },
  "segmentEndsAt": "2025-01-12T12:00:00Z"
}

// Response 404 — no pending capture
```

### `POST /replays/:id/confirm`

Confirm a pending capture. Requires auth + ownership.

```json
// Response 200
{ "id": "uuid", "status": "CONFIRMED", "confirmedAt": "2025-01-12T10:30:00Z" }
```

### `POST /replays/:id/reroll`

Re-roll a pending capture. Requires auth + ownership + available re-rolls.

```json
// Response 200
{
  "id": "uuid",
  "trackName": "New Track",
  "artistName": "Different Artist",
  "albumArtUrl": "https://...",
  "captureTime": "2025-01-12T09:15:00Z",
  "reRollsUsed": 1,
  "reRollsAvailable": 2
}

// Response 400 — "No re-rolls available"
```

### `GET /replays/feed?segment=MORNING&date=2025-01-12`

Feed of friends' captures for a segment. Requires auth. Date defaults to today.

```json
// Response 200 — unlocked (user confirmed)
{
  "segment": "MORNING",
  "date": "2025-01-12",
  "revealTime": "2025-01-12T12:00:00Z",
  "isRevealed": true,
  "userReplay": { "id": "uuid", "trackName": "Bohemian Rhapsody", "artistName": "Queen", "status": "CONFIRMED", "reRollsUsed": 1, "reactionCount": 3, "commentCount": 1 },
  "friendReplays": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "username": "alice", "displayName": "Alice" },
      "trackName": "Blinding Lights",
      "artistName": "The Weeknd",
      "albumArtUrl": "https://...",
      "captureTime": "2025-01-12T08:23:00Z",
      "status": "CONFIRMED",
      "reRollsUsed": 0,
      "reactionCount": 5,
      "commentCount": 2
    }
  ]
}

// Response 200 — locked (user hasn't confirmed)
{ "segment": "MORNING", "date": "2025-01-12", "isRevealed": true, "locked": true, "message": "Confirm your Morning Replay to unlock", "friendCount": 8 }
```

### `GET /replays/:id`

Detailed capture with reactions and comments. Requires auth + friendship/ownership.

```json
// Response 200
{
  "id": "uuid",
  "user": { "id": "uuid", "username": "alice", "displayName": "Alice", "profilePictureUrl": "https://..." },
  "segment": "MORNING",
  "segmentDate": "2025-01-12",
  "trackName": "Blinding Lights",
  "artistName": "The Weeknd",
  "albumName": "After Hours",
  "albumArtUrl": "https://...",
  "trackUri": "spotify:track:0VjIjW4GlUZAMYd2vXMi3b",
  "externalUrl": "https://open.spotify.com/track/...",
  "captureTime": "2025-01-12T08:23:00Z",
  "status": "CONFIRMED",
  "isLate": false,
  "isSilent": false,
  "reRollsUsed": 0,
  "reactions": [{ "id": "uuid", "user": { "username": "bob", "displayName": "Bob" }, "emoji": "fire", "createdAt": "..." }],
  "comments": [{ "id": "uuid", "user": { "username": "charlie", "displayName": "Charlie" }, "text": "This song is a vibe!", "createdAt": "..." }]
}
```

---

## Reactions

### `POST /replays/:id/reactions`

Add emoji reaction. One per user per capture. Requires auth.

```json
// Request
{ "emoji": "fire" }

// Response 201
{ "id": "uuid", "emoji": "fire", "createdAt": "..." }

// Response 400 — "Already reacted"
```

**Allowed emojis:** `fire`, `heart`, `laughing`, `music`, `eyes`, `raised_hands`

### `DELETE /replays/:id/reactions`

Remove your reaction. Requires auth.

```
// Response 204
```

---

## Comments

### `POST /replays/:id/comments`

Add comment (500 char max). Requires auth.

```json
// Request
{ "text": "Love this track!" }

// Response 201
{ "id": "uuid", "text": "Love this track!", "user": { "username": "bob", "displayName": "Bob" }, "createdAt": "..." }
```

### `DELETE /comments/:id`

Delete own comment. Requires auth + ownership.

```
// Response 204
```

---

## Friends

### `GET /friends?status=ACCEPTED`

List friends. Status: `ACCEPTED` (default), `PENDING`. Requires auth.

```json
// Response 200
{
  "friends": [
    { "id": "uuid", "username": "alice", "displayName": "Alice", "profilePictureUrl": "https://...", "friendshipStatus": "ACCEPTED", "friendsSince": "2025-01-01T00:00:00Z" }
  ]
}
```

### `POST /friends/requests`

Send friend request. Requires auth.

```json
// Request
{ "username": "alice" }

// Response 201
{ "id": "uuid", "status": "PENDING", "addressee": { "username": "alice", "displayName": "Alice" } }

// Response 409 — "Friendship already exists"
```

### `POST /friends/requests/:id/accept`

Accept request. Requires auth + must be the addressee.

```json
// Response 200
{ "id": "uuid", "status": "ACCEPTED", "acceptedAt": "..." }
```

### `POST /friends/requests/:id/reject`

Reject request. Requires auth + must be the addressee.

```json
// Response 200
{ "id": "uuid", "status": "REJECTED" }
```

### `DELETE /friends/:friendshipId`

Unfriend. Requires auth + must be a party to the friendship.

```
// Response 204
```

---

## Playlists

### `POST /playlists`

Generate playlist from captures. Requires auth.

```json
// Request
{ "name": "January Morning Vibes", "timeRangeStart": "2025-01-01", "timeRangeEnd": "2025-01-31", "segmentsIncluded": ["MORNING"], "friendIdsIncluded": null }

// Response 201
{ "id": "uuid", "name": "January Morning Vibes", "trackCount": 27, "tracks": [{ "trackName": "Good Vibrations", "artistName": "The Beach Boys", "albumArtUrl": "https://..." }] }
```

### `POST /playlists/:id/export`

Export to Spotify. Requires auth.

```json
// Request
{ "platform": "SPOTIFY" }

// Response 200
{ "externalPlaylistId": "spotify_id", "externalPlaylistUrl": "https://open.spotify.com/playlist/...", "trackCount": 27 }
```

---

## Admin (Development Only)

### `POST /admin/generate-schedule`

Manually trigger daily schedule generation for the authenticated user.

```json
// Response 200
{ "message": "Schedule generated successfully" }
```

---

## WebSocket Events

**Connection:** `io('ws://localhost:3000', { auth: { token: 'jwt' } })`

### Client → Server

| Event | Payload | Effect |
|-------|---------|--------|
| `join_feed` | `{ segment, date }` | Subscribe to `feed:{segment}:{date}` room |
| `leave_feed` | `{ segment, date }` | Unsubscribe from room |

### Server → Client

| Event | Room | Payload |
|-------|------|---------|
| `segment_revealed` | `feed:{segment}:{date}` | `{ segment, date, revealedAt }` |
| `replay_confirmed` | `feed:{segment}:{date}` | `{ segment, date, replay: { id, user, trackName, albumArtUrl } }` |
| `reaction_added` | `user:{replayOwnerId}` | `{ replayId, reaction: { user, emoji } }` |
| `comment_added` | `user:{replayOwnerId}` | `{ replayId, comment: { user, text } }` |
| `friend_request` | `user:{addresseeId}` | `{ requestId, requester: { username, displayName } }` |

---

## Common Patterns

### Error Format

```json
{ "error": "Human-readable message", "code": "ERROR_CODE" }
```

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing/invalid JWT |
| 403 | `FORBIDDEN` | Not authorized for this resource |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Duplicate resource |
| 429 | `RATE_LIMIT` | Too many requests (includes `retryAfter` in seconds) |

### Pagination

List endpoints support cursor-based pagination:

```
GET /friends?limit=20&cursor=abc123

// Response includes:
{ "data": [...], "pagination": { "nextCursor": "def456", "hasMore": true } }
```

### Rate Limits

- Default: 100 req/min per user
- Auth endpoints: 10 req/min
- WebSocket: 5 connections per user
