import { strict as assert } from 'node:assert';
import test from 'node:test';

import { getDueSegmentExpirations, getDueSegmentReveals } from './segments';

test('detects a user-local morning reveal at noon in their timezone', () => {
  const due = getDueSegmentReveals(
    new Date('2026-05-16T16:00:00.000Z'),
    'America/New_York',
    15 * 60 * 1000,
  );

  assert.deepEqual(due, [
    { segment: 'MORNING', segmentDate: new Date('2026-05-16T00:00:00.000Z') },
  ]);
});

test('detects late-night reveal against the previous local segment date', () => {
  const due = getDueSegmentReveals(
    new Date('2026-05-17T07:00:00.000Z'),
    'America/New_York',
    15 * 60 * 1000,
  );

  assert.deepEqual(due, [
    { segment: 'LATE_NIGHT', segmentDate: new Date('2026-05-16T00:00:00.000Z') },
  ]);
});

test('detects grace-period expiration one hour after local reveal', () => {
  const due = getDueSegmentExpirations(
    new Date('2026-05-16T17:00:00.000Z'),
    'America/New_York',
    15 * 60 * 1000,
  );

  assert.deepEqual(due, [
    { segment: 'MORNING', segmentDate: new Date('2026-05-16T00:00:00.000Z') },
  ]);
});

test('does not repeat reveals outside the due window', () => {
  const due = getDueSegmentReveals(
    new Date('2026-05-16T16:20:00.000Z'),
    'America/New_York',
    15 * 60 * 1000,
  );

  assert.deepEqual(due, []);
});
