import { Segment } from '@prisma/client';
import prisma from './prisma';
import { captureQueue } from './queue';
import { getSegmentWindow, randomTimeBetween, allocateReRolls, segmentDateForTimeZone } from './segments';

export async function generateDailySchedule(userId: string, date: Date, segments?: Segment[], timeZone = 'UTC') {
  const segmentList: Segment[] = segments || ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];

  const segmentDate = new Date(date);
  segmentDate.setUTCHours(0, 0, 0, 0);

  for (const segment of segmentList) {
    // Check if schedule already exists
    const existing = await prisma.captureSchedule.findUnique({
      where: { userId_segmentDate_segment: { userId, segmentDate, segment } },
    });
    if (existing) continue;

    const { start, end } = getSegmentWindow(segment, segmentDate, timeZone);
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
      await captureQueue.add(
        'capture',
        { scheduleId: schedule.id },
        {
          delay,
          attempts: 4, // initial + 3 retries
          backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m
          removeOnComplete: true,
          removeOnFail: 100, // keep last 100 failures for diagnosis
        },
      );
    }
  }
}

export async function generateAllSchedules(date: Date) {
  let count = 0;
  let cursor: string | undefined;

  while (true) {
    const users = await prisma.user.findMany({
      where: { musicServiceUserId: { not: 'pending' } },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;

    for (const user of users) {
      try {
        await generateDailySchedule(user.id, segmentDateForTimeZone(date, user.timezone), undefined, user.timezone);
        count++;
      } catch (err) {
        console.error(`Schedule generation failed for ${user.id}:`, err);
      }
    }

    cursor = users[users.length - 1].id;
    if (users.length < 500) break;
  }

  console.log(`Generated schedules for ${count} users`);
}
