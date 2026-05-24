import { Segment } from '@prisma/client';

export const SEGMENT_WINDOWS: Record<Segment, { start: number; end: number }> = {
  MORNING: { start: 6, end: 12 },
  AFTERNOON: { start: 12, end: 19 },
  NIGHT: { start: 19, end: 23 },
  LATE_NIGHT: { start: 23, end: 27 }, // 23:00 to 03:00 next day
};

export const SEGMENT_LABELS: Record<Segment, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  NIGHT: 'Night',
  LATE_NIGHT: 'Late Night',
};

export const SEGMENT_ORDER: Segment[] = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

export type SegmentOccurrence = {
  segment: Segment;
  segmentDate: Date;
};

function timeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
) {
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = new Date(localAsUtc);

  for (let i = 0; i < 3; i++) {
    const parts = timeZoneParts(utc, timeZone);
    const renderedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const offset = renderedAsUtc - utc.getTime();
    utc = new Date(localAsUtc - offset);
  }

  return utc;
}

export function segmentDateForTimeZone(now: Date, timeZone: string): Date {
  const parts = timeZoneParts(now, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
}

function segmentDateParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function getSegmentWindow(segment: Segment, date: Date, timeZone = 'UTC'): { start: Date; end: Date } {
  const { start, end } = SEGMENT_WINDOWS[segment];
  const parts = segmentDateParts(date);
  const startDate = zonedTimeToUtc(timeZone, parts.year, parts.month, parts.day, start % 24);
  const endDate = zonedTimeToUtc(
    timeZone,
    parts.year,
    parts.month,
    parts.day + (end > 24 ? 1 : 0),
    end % 24,
  );
  return { start: startDate, end: endDate };
}

export function getRevealTime(segment: Segment, date: Date, timeZone = 'UTC'): Date {
  const { end } = SEGMENT_WINDOWS[segment];
  const parts = segmentDateParts(date);
  return zonedTimeToUtc(
    timeZone,
    parts.year,
    parts.month,
    parts.day + (end > 24 ? 1 : 0),
    end % 24,
  );
}

function candidateSegmentDates(now: Date, timeZone: string): Date[] {
  const current = segmentDateForTimeZone(now, timeZone);
  const previous = new Date(current);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return [previous, current];
}

function isWithinDueWindow(dueTime: Date, now: Date, lookbackMs: number): boolean {
  return dueTime.getTime() <= now.getTime() && dueTime.getTime() > now.getTime() - lookbackMs;
}

function getDueSegmentOccurrences(
  now: Date,
  timeZone: string,
  lookbackMs: number,
  dueTimeFor: (segment: Segment, segmentDate: Date) => Date,
): SegmentOccurrence[] {
  const due: SegmentOccurrence[] = [];

  for (const segmentDate of candidateSegmentDates(now, timeZone)) {
    for (const segment of SEGMENT_ORDER) {
      const dueTime = dueTimeFor(segment, segmentDate);
      if (isWithinDueWindow(dueTime, now, lookbackMs)) {
        due.push({ segment, segmentDate: new Date(segmentDate) });
      }
    }
  }

  return due;
}

export function getDueSegmentReveals(
  now: Date,
  timeZone = 'UTC',
  lookbackMs = 15 * 60 * 1000,
): SegmentOccurrence[] {
  return getDueSegmentOccurrences(now, timeZone, lookbackMs, (segment, segmentDate) =>
    getRevealTime(segment, segmentDate, timeZone)
  );
}

export function getDueSegmentExpirations(
  now: Date,
  timeZone = 'UTC',
  lookbackMs = 15 * 60 * 1000,
): SegmentOccurrence[] {
  return getDueSegmentOccurrences(now, timeZone, lookbackMs, (segment, segmentDate) => {
    const revealTime = getRevealTime(segment, segmentDate, timeZone);
    return new Date(revealTime.getTime() + 60 * 60 * 1000);
  });
}

export function getCurrentSegment(timeZone = 'UTC'): Segment | null {
  const hour = timeZoneParts(new Date(), timeZone).hour;
  if (hour >= 6 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 19) return 'AFTERNOON';
  if (hour >= 19 && hour < 23) return 'NIGHT';
  if (hour >= 23 || hour < 3) return 'LATE_NIGHT';
  return null; // Quiet period 3am-6am
}

export function randomTimeBetween(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export function allocateReRolls(): number {
  const r = Math.random();
  if (r < 0.6) return 0;
  if (r < 0.9) return 1;
  return 2;
}

export function isInGracePeriod(segment: Segment, date: Date, timeZone = 'UTC'): boolean {
  const revealTime = getRevealTime(segment, date, timeZone);
  const graceEnd = new Date(revealTime.getTime() + 60 * 60 * 1000); // 1 hour grace
  const now = new Date();
  return now >= revealTime && now <= graceEnd;
}
