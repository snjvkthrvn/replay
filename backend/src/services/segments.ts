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

export function getSegmentWindow(segment: Segment, date: Date): { start: Date; end: Date } {
  const { start, end } = SEGMENT_WINDOWS[segment];
  const startDate = new Date(date);
  startDate.setHours(start % 24, 0, 0, 0);
  const endDate = new Date(date);
  if (end > 24) {
    endDate.setDate(endDate.getDate() + 1);
    endDate.setHours(end - 24, 0, 0, 0);
  } else {
    endDate.setHours(end, 0, 0, 0);
  }
  return { start: startDate, end: endDate };
}

export function getRevealTime(segment: Segment, date: Date): Date {
  const { end } = SEGMENT_WINDOWS[segment];
  const revealDate = new Date(date);
  if (end > 24) {
    revealDate.setDate(revealDate.getDate() + 1);
    revealDate.setHours(end - 24, 0, 0, 0);
  } else {
    revealDate.setHours(end, 0, 0, 0);
  }
  return revealDate;
}

export function getCurrentSegment(): Segment | null {
  const hour = new Date().getHours();
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

export function isInGracePeriod(segment: Segment, date: Date): boolean {
  const revealTime = getRevealTime(segment, date);
  const graceEnd = new Date(revealTime.getTime() + 60 * 60 * 1000); // 1 hour grace
  const now = new Date();
  return now >= revealTime && now <= graceEnd;
}
