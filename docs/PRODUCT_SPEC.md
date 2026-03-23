# Product Specification — Replay

> See what your friends are *actually* listening to — not what they want you to think they listen to.

## Vision

Replay captures your Spotify listening at random moments across four daily time windows, then reveals everyone's captures simultaneously. No curation, no performance, just the real soundtrack of your day.

---

## Core Mechanic

The entire product loops through four steps, four times a day:

```
CAPTURE → CONFIRM → REVEAL → REACT
```

1. **Capture** — At a random moment in each segment, the server queries Spotify for what you're playing. You can't choose when. You can't prepare.
2. **Confirm** — You see your capture and decide: accept it, or burn a re-roll (if you have one). You must confirm to see your friends' captures.
3. **Reveal** — When the segment ends, everyone's confirmed captures unlock at the same time. The anticipation is the product.
4. **React** — Browse your friends' captures. React with emoji. Comment. Discover songs.

---

## The Four Segments

| Segment | Window | Reveal Time | Vibe |
|---------|--------|-------------|------|
| Morning | 6:00 AM – 12:00 PM | 12:00 PM | Commute, coffee, gym |
| Afternoon | 12:00 PM – 7:00 PM | 7:00 PM | Work, focus, errands |
| Night | 7:00 PM – 11:00 PM | 11:00 PM | Dinner, unwind, social |
| Late Night | 11:00 PM – 3:00 AM | 3:00 AM | Late sessions, insomnia |

**Quiet period:** 3:00 AM – 6:00 AM. No captures.

All times are local to the user's timezone.

---

## Re-Roll System

Re-rolls let you swap your capture for a different track from your listening history within the same segment. They're randomly allocated per segment:

| Re-Rolls | Probability | Most Users Get |
|----------|-------------|----------------|
| 0 | 60% | No choice — this is what you were playing |
| 1 | 30% | One shot at something different |
| 2 | 10% | Lucky — two chances to swap |

Re-roll count is visible on your final card, so friends can see if you re-rolled. This creates social accountability — the most authentic captures use zero.

---

## Give-to-Get

You must confirm your own capture before seeing anyone else's. No lurking. If you didn't confirm, you see a locked screen showing how many friends are waiting.

This solves the cold-start engagement problem: every participant is also a contributor.

---

## Replay Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Captured, waiting for user to confirm or re-roll |
| `CONFIRMED` | User confirmed before segment end |
| `LATE` | User confirmed during the 1-hour grace period after segment end |
| `SILENT` | User wasn't listening to anything — shows a silent card |
| `MISSED` | Grace period expired without confirmation |

Late and silent captures still count toward the Curator Badge. Missed ones don't.

---

## Curator Badge

Awarded for confirming 80%+ of captures over a rolling 14-day window. Displayed on your profile. Resets daily based on trailing activity.

This rewards consistency without punishing a single missed day.

---

## Features by Priority

### P0 — Must Ship

- Spotify OAuth + automatic token refresh
- Server-side random capture scheduling
- All 4 segments with timezone support
- Re-roll mechanic (weighted 60/30/10)
- Collective reveal at segment boundaries
- Give-to-get access control
- Chronological friends-only feed (album art grid)
- Emoji reactions (one per user per capture, curated set)
- Text comments (500 char max, flat threading)
- Push notifications: capture alert, reveal alert, reaction, comment
- Mutual friend system (request → accept)

### P1 — Should Ship

- Profile with calendar archive of past captures
- Playlist generation from captures (export to Spotify)
- Silent capture handling with dedicated UI
- Late confirmation with visual indicator
- Curator Badge with streak tracking
- User search by username

### P2 — Nice to Have

- Apple Music integration
- Suggested friends (mutual connections, phone contacts)
- Segment-specific color themes
- Reaction animations

---

## User Flow — First Session

```
Download → Sign up (email/password) → Connect Spotify (OAuth)
→ Grant notification permissions → Add friends (search by username)
→ See brief tutorial → Wait for first capture notification
→ Open app → View captured track → Confirm (or re-roll)
→ Wait for segment to end → Receive reveal notification
→ Open app → Browse friends' album art grid
→ Tap to view details → React / comment
```

Time to first value: ~1 segment cycle (at most 6 hours after signup, depending on when they join).

---

## Edge Cases

### User isn't playing music
Capture their most recently played track from the segment window. If no history exists, create a Silent Replay.

### User is on the boundary between segments
Captures are scheduled with random timestamps well within the segment window, making exact boundary hits extremely unlikely. The server handles any edge case by assigning to the active segment.

### Spotify token expires
Automatic refresh via stored refresh token. If refresh fails, push notification asking to re-authenticate. Captures pause but existing data is preserved.

### User changes timezone (travel)
Timezone updates at midnight local time. Segment windows recalculate for the new day. In-progress segments complete on the original schedule.

### Grace period
1 hour after segment end. User can still confirm, but the capture is marked `LATE` with a visual indicator. After grace period, status becomes `MISSED`.

### Multiple devices
Device tokens are stored per-device. Push notifications go to all registered devices. Any device can confirm.

---

## What We're NOT Building (V1)

- Public profiles or discovery algorithms
- In-app music playback (tap to open in Spotify)
- Music recommendation engine
- Group playlists with voting
- Algorithmic or trending feeds
- Group chats or DMs
- Monetization (ads, subscriptions)
- Desktop or web app

---

## Success Metrics

### Engagement
- **DAU/MAU:** >40%
- **Segments confirmed per user per day:** 2.0+ (50% capture rate)
- **Reveal open rate:** % who open app after reveal notification

### Retention
- **D1:** >60%
- **D7:** >35%
- **D30:** >20%

### Social
- **Reactions per capture:** 1.5+ average
- **Comments per capture:** 0.3+ average
- **Friends per user:** 8+ average

### Technical
- **Capture success rate:** >90%
- **Feed load time:** <2 seconds
- **Push notification delivery:** <5 seconds from trigger

---

## Design Principles

1. **Authenticity over curation** — Random server-side capture prevents gaming
2. **Fast in, fast out** — <10s to confirm, <5s to browse the feed
3. **The reveal is the reward** — Anticipation builds; collective unlock creates a shared moment
4. **Structure creates meaning** — Four segments tell the story of your day
5. **Intimacy over scale** — Close friends only, not followers
6. **Album art is the hero** — UI frames the music, doesn't compete with it
