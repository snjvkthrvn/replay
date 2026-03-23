import { Segment } from '@prisma/client';
import prisma from './prisma';
import { captureQueue } from './queue';
import { getSegmentWindow, randomTimeBetween, allocateReRolls } from './segments';

export async function generateDailySchedule(userId: string, date: Date, segments?: Segment[]) {
  const segmentList: Segment[] = segments || ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

  const segmentDate = new Date(date);
  segmentDate.setHours(0, 0, 0, 0);

  for (const segment of segmentList) {
    // Check if schedule already exists
    const existing = await prisma.captureSchedule.findUnique({
      where: { userId_segmentDate_segment: { userId, segmentDate, segment } },
    });
    if (existing) continue;

    const { start, end } = getSegmentWindow(segment, date);
    const captureTime = randomTimeBetween(start, end);
    const reRolls = allocateReRolls();

    const schedule = await prisma.captureSchedule.create({
      data: {
        userId,
        segment,
        segmentDate,
        scheduledCaptureTime: captureTime,
        reRollsAllocated: reRolls,
      },
    });

    const delay = captureTime.getTime() - Date.now();
    if (delay > 0) {
      await captureQueue.add('capture', { scheduleId: schedule.id }, { delay });
    }
  }
}

export async function generateAllSchedules(date: Date) {
  const users = await prisma.user.findMany({
    where: { musicServiceUserId: { not: 'pending' } },
  });

  let count = 0;
  for (const user of users) {
    try {
      await generateDailySchedule(user.id, date);
      count++;
    } catch (err) {
      console.error(`Schedule generation failed for ${user.id}:`, err);
    }
  }
  console.log(`Generated schedules for ${count} users`);
}
