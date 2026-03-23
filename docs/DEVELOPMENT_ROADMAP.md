# Development Roadmap — Replay

> 16-week plan from empty repo to MVP launch.

```
Weeks 1–4    Phase 1: Core Loop        Get capture → confirm → reveal working (Morning segment only)
Weeks 5–8    Phase 2: Full System      All 4 segments, re-rolls, reactions, comments, real-time
Weeks 9–12   Phase 3: Profile & Polish Profiles, playlists, curator badge, friend discovery
Weeks 13–16  Phase 4: Launch Prep      Onboarding, performance, QA, beta testing
```

**Status:** Not started. All tasks below are pending.

---

## Phase 1: Core Loop (Weeks 1–4)

**Goal:** A single segment (Morning) works end-to-end. A user can sign up, connect Spotify, get captured, confirm, and see friends' captures at noon.

### Week 1–2: Foundation

- [ ] Initialize backend (Express + TypeScript) and mobile (Expo + TypeScript) repos
- [ ] Set up Docker Compose with Postgres and Redis
- [ ] Create Prisma schema: `User`, `Replay`, `CaptureSchedule` tables
- [ ] Run first migration
- [ ] Implement auth: signup, login, JWT generation/verification, auth middleware
- [ ] Implement Spotify OAuth: initiate flow, handle callback, store encrypted tokens, refresh logic
- [ ] Basic user profile endpoints: `GET /users/me`, `PATCH /users/me`

**Milestone:** User can sign up and connect Spotify account.

### Week 3: Capture System

- [ ] Build `CaptureScheduler` service: generate daily schedule at midnight, pick random timestamps, allocate re-rolls
- [ ] Build `CaptureExecutor` service: query Spotify API, create Replay, handle silent captures
- [ ] Set up Bull queue: capture jobs fire at scheduled timestamps
- [ ] Set up capture worker process (`npm run worker`)
- [ ] Implement push notifications via FCM: "Captured!" alert
- [ ] Device token registration endpoint
- [ ] Replay endpoints: `GET /replays/pending`, `POST /replays/:id/confirm`

**Milestone:** System captures a user's track at a random morning moment; user can confirm.

### Week 4: Reveal & Feed

- [ ] Build `RevealProcessor`: cron job at noon, send "Replays are in!" push, mark missed captures
- [ ] Basic friend system: send request, accept, list friends
- [ ] Build `FeedGenerator`: query friends' confirmed replays, enforce give-to-get
- [ ] Feed endpoint: `GET /replays/feed?segment=MORNING`
- [ ] Mobile screens: login, signup, pending capture, feed (album art list), profile

**Milestone:** Complete Morning segment loop — capture at random time, confirm, see friends' captures at noon.

### Phase 1 Success Criteria
- [ ] Capture success rate >90%
- [ ] Feed loads in <2 seconds
- [ ] End-to-end flow works without errors
- [ ] 5 test users can use the app for 3 days

---

## Phase 2: Full System (Weeks 5–8)

**Goal:** All 4 segments active. Re-rolls, reactions, comments, and real-time updates working.

### Week 5: All 4 Segments

- [ ] Update CaptureScheduler to generate schedules for all 4 segments
- [ ] Update RevealProcessor with reveal times: 12 PM, 7 PM, 11 PM, 3 AM
- [ ] Handle timezone-based scheduling (schedules generate per user timezone)
- [ ] Mobile: segment tabs in feed view

**Milestone:** Users have 4 capture opportunities per day.

### Week 6: Re-Roll System

- [ ] Re-roll endpoint: `POST /replays/:id/reroll`
- [ ] Query Spotify listening history for the segment window
- [ ] Pick random track from history as replacement
- [ ] Enforce re-roll limits (check `reRollsAvailable` vs `reRollsUsed`)
- [ ] Mobile: re-roll button with remaining count, disable when exhausted
- [ ] Display re-roll count on final capture card

**Milestone:** Users can re-roll captures with limited attempts.

### Week 7: Reactions & Comments

- [ ] Reactions table + endpoints: add (POST), remove (DELETE)
- [ ] Comments table + endpoints: add (POST), delete (DELETE)
- [ ] Denormalized count updates (increment/decrement in transactions)
- [ ] Push notifications for reactions and comments
- [ ] Mobile: emoji reaction picker, comment input (500 char), display on capture detail

**Milestone:** Full social interaction on captures.

### Week 8: Real-Time (WebSocket)

- [ ] Socket.IO server setup with JWT auth on connection
- [ ] Room management: `user:{id}` for personal, `feed:{segment}:{date}` for segment feeds
- [ ] Emit events: `replay_confirmed`, `segment_revealed`, `reaction_added`, `comment_added`
- [ ] Mobile: Socket.IO client, auto-connect on auth, invalidate TanStack Query on events
- [ ] Auto-refresh feed when friend confirms

**Milestone:** Live updates without manual refresh.

### Phase 2 Success Criteria
- [ ] 2+ segments confirmed per user per day
- [ ] 1.5+ reactions per capture average
- [ ] WebSocket connection stable for >1 hour

---

## Phase 3: Profile & Polish (Weeks 9–12)

**Goal:** Profiles, playlist export, curator badge, and friend discovery.

### Week 9: User Profiles

- [ ] Profile view endpoint: `GET /users/:username`
- [ ] Calendar archive: `GET /users/:username/archive?month=YYYY-MM`
- [ ] Stats: confirmation rate, top artists, monthly summary
- [ ] Mobile: profile screen with stats header, calendar grid, segment filter

### Week 10: Playlist Generation

- [ ] Playlist builder service: query replays by filters, deduplicate tracks
- [ ] Endpoints: `POST /playlists`, `GET /playlists/:id`, `POST /playlists/:id/export`
- [ ] Spotify API: create playlist, add tracks in batch, return playlist URL
- [ ] Mobile: playlist builder UI with date range, segment filter, friend filter, preview

### Week 11: Curator Badge & Late Confirmations

- [ ] Curator badge calculation: 80%+ confirmation over rolling 14 days
- [ ] Daily cron job to update badge status
- [ ] Late confirmation: allow confirms up to 1 hour after segment end, mark as `LATE`
- [ ] Silent replay handling: dedicated UI with silent icon
- [ ] Mobile: badge display on profile, late/silent indicators on cards

### Week 12: Friend Discovery

- [ ] User search endpoint: `GET /users/search?q=...`
- [ ] Suggested friends: mutual connections
- [ ] Friend management: block, unfriend, view pending requests
- [ ] Mobile: friend discovery screen with search, suggestions, pending requests tab

### Phase 3 Success Criteria
- [ ] 30%+ users earn curator badge
- [ ] 1+ playlist created per user
- [ ] 8+ friends per user average

---

## Phase 4: Launch Prep (Weeks 13–16)

**Goal:** Bug fixes, performance, onboarding, beta testing.

### Week 13: Onboarding

- [ ] Tutorial screens explaining 4-segment concept
- [ ] Onboarding checklist: connect Spotify, add 3+ friends, confirm first capture
- [ ] Empty states: no friends, no captures, friend missed segment
- [ ] First-run experience optimization

### Week 14: Performance

- [ ] Frontend: lazy load album art, virtualized lists, reduce bundle size (<5MB)
- [ ] Backend: query optimization (EXPLAIN ANALYZE), add missing indexes, PgBouncer
- [ ] Caching: increase feed TTL, cache friend lists, pre-warm caches at reveal time
- [ ] Load test: 100 concurrent users, verify feed <2s

### Week 15: QA & Edge Cases

- [ ] Spotify token expiry: auto-refresh, re-auth notification
- [ ] Timezone changes: recalculate schedules
- [ ] Network failures: retry logic, offline mode (cached data), exponential backoff
- [ ] Edge cases: confirm at segment boundary, multiple devices, reaction spam (rate limiting)
- [ ] Test on iOS + Android, across timezones, on poor network

### Week 16: Launch

- [ ] App Store assets: screenshots, description, privacy policy, terms
- [ ] Analytics: Mixpanel/Amplitude, track key events, funnel analysis
- [ ] Error monitoring: Sentry
- [ ] Beta test with 50 users, collect feedback, fix critical bugs
- [ ] Deploy backend to production, automate database backups, set up monitoring dashboards

### Phase 4 Success Criteria
- [ ] D1 retention >60%, D7 >35%
- [ ] No critical bugs in 3 days of beta
- [ ] Performance score >90

---

## Post-Launch (Weeks 17–20)

- Week 17: Monitor beta feedback
- Week 18: Fix top 5 user-reported issues
- Week 19: A/B test onboarding improvements
- Week 20: Public launch

### Future (V2)
- Apple Music integration
- Group playlists
- Replay streaks (7-day, 30-day badges)
- Playlist sharing (public links)
- Advanced analytics (listening patterns)
- Desktop web app (read-only feed)

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| React Native over Flutter | Better ecosystem for OAuth and Spotify integration |
| Prisma over TypeORM | Better DX, type safety, migration workflow |
| Bull over Agenda | More robust job queue, better cron and retry support |
| 4 segments (not 3 or 5) | Balances engagement with notification fatigue |
| 60/30/10 re-roll distribution | Prevents gaming while allowing some control |
| 1-hour grace period | Flexible enough for busy users, tight enough to preserve reveal timing |
| App-level denormalization over DB triggers | More visible, testable, and portable |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Falling behind schedule | High | Cut P2 features, reduce to 3 segments, launch Spotify-only |
| Spotify API rate limits | High | Batch API calls, exponential backoff, cache listening history |
| Low user engagement | Medium | A/B test notifications, experiment with segment timing, add streaks |
| Push notification failures | Medium | Retry logic, monitor FCM delivery, fallback to in-app notifications |
| Low friend density | High | Onboarding prompts for 5+ friends, suggested friends, value prop works with 3 friends |
