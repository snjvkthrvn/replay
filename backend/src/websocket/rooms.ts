import { Segment } from '@prisma/client';

export function formatSegmentDate(date: Date | string): string {
  if (date instanceof Date) return date.toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid segment date');
  }
  return date;
}

export function feedRoom(userId: string, segment: Segment | string, date: Date | string): string {
  return `feed:${userId}:${segment}:${formatSegmentDate(date)}`;
}
