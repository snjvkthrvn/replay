import { strict as assert } from 'node:assert';
import test from 'node:test';

import { buildPlaylistReplayWhere, exportToSpotify } from './playlistService';

test('exportToSpotify requires the caller user id', () => {
  assert.equal(exportToSpotify.length, 2);
});

test('playlist replay query excludes friend replays for locked segments', () => {
  const where = buildPlaylistReplayWhere(
    'viewer',
    {
      timeRangeStart: new Date('2026-05-16T00:00:00.000Z'),
      timeRangeEnd: new Date('2026-05-17T00:00:00.000Z'),
      segments: ['MORNING'],
    },
    ['friend-1'],
    [],
  );

  assert.deepEqual(where.OR, [{ userId: 'viewer' }]);
});

test('playlist replay query includes friend replays only for viewer-unlocked segments', () => {
  const segmentDate = new Date('2026-05-16T00:00:00.000Z');
  const where = buildPlaylistReplayWhere(
    'viewer',
    {
      timeRangeStart: segmentDate,
      timeRangeEnd: new Date('2026-05-17T00:00:00.000Z'),
      segments: ['MORNING'],
    },
    ['friend-1'],
    [{ segment: 'MORNING', segmentDate }],
  );

  assert.deepEqual(where.OR, [
    { userId: 'viewer' },
    {
      userId: { in: ['friend-1'] },
      OR: [{ segment: 'MORNING', segmentDate }],
    },
  ]);
});
