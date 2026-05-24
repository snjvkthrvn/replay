import { strict as assert } from 'node:assert';
import test from 'node:test';

import { canViewReplay, canInteractWithReplay } from './accessControl';

const segmentDate = new Date('2026-05-16T00:00:00.000Z');

test('owners can view their own pending replay, but cannot publicly interact with pending replays', () => {
  const replay = {
    userId: 'owner',
    segment: 'MORNING',
    segmentDate,
    status: 'PENDING',
  } as const;

  assert.equal(canViewReplay({ viewerId: 'owner', replay, areFriends: false, viewerUnlockedSegment: false }), true);
  assert.equal(canInteractWithReplay({ viewerId: 'owner', replay, areFriends: false, viewerUnlockedSegment: false }), false);
});
test('friends can view and interact only after both the target replay is shareable and viewer unlocked the segment', () => {
  const replay = {
    userId: 'friend',
    segment: 'MORNING',
    segmentDate,
    status: 'CONFIRMED',
  } as const;

  assert.equal(canViewReplay({ viewerId: 'viewer', replay, areFriends: false, viewerUnlockedSegment: true }), false);
  assert.equal(canViewReplay({ viewerId: 'viewer', replay, areFriends: true, viewerUnlockedSegment: false }), false);
  assert.equal(canViewReplay({ viewerId: 'viewer', replay, areFriends: true, viewerUnlockedSegment: true }), true);
  assert.equal(canInteractWithReplay({ viewerId: 'viewer', replay, areFriends: true, viewerUnlockedSegment: true }), true);
});
