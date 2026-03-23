import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@test.com' },
    update: {},
    create: {
      email: 'alice@test.com',
      username: 'alice',
      displayName: 'Alice',
      passwordHash,
      musicService: 'SPOTIFY',
      musicServiceUserId: 'spotify_alice',
      accessToken: 'fake_token',
      refreshToken: 'fake_refresh',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@test.com' },
    update: {},
    create: {
      email: 'bob@test.com',
      username: 'bob',
      displayName: 'Bob',
      passwordHash,
      musicService: 'SPOTIFY',
      musicServiceUserId: 'spotify_bob',
      accessToken: 'fake_token',
      refreshToken: 'fake_refresh',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@test.com' },
    update: {},
    create: {
      email: 'charlie@test.com',
      username: 'charlie',
      displayName: 'Charlie',
      passwordHash,
      musicService: 'SPOTIFY',
      musicServiceUserId: 'spotify_charlie',
      accessToken: 'fake_token',
      refreshToken: 'fake_refresh',
    },
  });

  // Alice-Bob friendship
  await prisma.friendship.upsert({
    where: { requesterId_addresseeId: { requesterId: alice.id, addresseeId: bob.id } },
    update: {},
    create: {
      requesterId: alice.id,
      addresseeId: bob.id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    },
  });

  // Update friend counts
  await prisma.user.update({ where: { id: alice.id }, data: { totalFriends: 1 } });
  await prisma.user.update({ where: { id: bob.id }, data: { totalFriends: 1 } });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sample CONFIRMED replay for Alice
  await prisma.replay.upsert({
    where: { userId_segmentDate_segment: { userId: alice.id, segmentDate: today, segment: 'MORNING' } },
    update: {},
    create: {
      userId: alice.id,
      segment: 'MORNING',
      segmentDate: today,
      captureTime: new Date(),
      captureScheduledTime: new Date(),
      trackName: 'Good Vibrations',
      artistName: 'The Beach Boys',
      albumName: 'Pet Sounds',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  });

  // Sample PENDING replay for Bob (for testing give-to-get feed flow)
  await prisma.replay.upsert({
    where: { userId_segmentDate_segment: { userId: bob.id, segmentDate: today, segment: 'MORNING' } },
    update: {},
    create: {
      userId: bob.id,
      segment: 'MORNING',
      segmentDate: today,
      captureTime: new Date(),
      captureScheduledTime: new Date(),
      trackName: 'Bohemian Rhapsody',
      artistName: 'Queen',
      albumName: 'A Night at the Opera',
      status: 'PENDING',
    },
  });

  // CaptureSchedule entries for all 3 users (MORNING segment)
  const morningStart = new Date(today);
  morningStart.setHours(8, 0, 0, 0);

  for (const user of [alice, bob, charlie]) {
    await prisma.captureSchedule.upsert({
      where: { userId_segmentDate_segment: { userId: user.id, segmentDate: today, segment: 'MORNING' } },
      update: {},
      create: {
        userId: user.id,
        segment: 'MORNING',
        segmentDate: today,
        scheduledCaptureTime: morningStart,
        reRollsAllocated: 1,
        captureAttempted: user.id === alice.id || user.id === bob.id,
        captureSucceeded: user.id === alice.id || user.id === bob.id,
      },
    });
  }

  console.log('Seeded: alice, bob, charlie, alice-bob friendship, replays, capture schedules');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
