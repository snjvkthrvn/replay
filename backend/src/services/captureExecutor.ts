import prisma from './prisma';
import { getCurrentlyPlaying, getRecentlyPlayed, ensureValidToken } from './spotify';
import { getSegmentWindow } from './segments';
import { sendPushNotification } from './pushNotifications';

export async function executeCapture(scheduleId: string) {
  const schedule = await prisma.captureSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: { user: true },
  });

  // Mark as attempted
  await prisma.captureSchedule.update({
    where: { id: scheduleId },
    data: { captureAttempted: true },
  });

  // Ensure valid Spotify token
  const accessToken = await ensureValidToken(schedule.user);

  // Try currently playing first
  let track = await getCurrentlyPlaying(accessToken);

  // Fallback to recently played
  if (!track) {
    const { start, end } = getSegmentWindow(schedule.segment, schedule.segmentDate);
    const history = await getRecentlyPlayed(accessToken, start, end);
    if (history.length > 0) {
      const pick = history[Math.floor(Math.random() * history.length)];
      track = {
        trackName: pick.trackName,
        artistName: pick.artistName,
        albumName: pick.albumName,
        albumArtUrl: pick.albumArtUrl,
        trackUri: pick.trackUri,
        externalUrl: pick.externalUrl,
      };
    }
  }

  // Create replay
  const replay = await prisma.replay.create({
    data: {
      userId: schedule.userId,
      segment: schedule.segment,
      segmentDate: schedule.segmentDate,
      captureTime: new Date(),
      captureScheduledTime: schedule.scheduledCaptureTime,
      reRollsAvailable: schedule.reRollsAllocated,
      ...(track
        ? {
            trackName: track.trackName,
            artistName: track.artistName,
            albumName: track.albumName,
            albumArtUrl: track.albumArtUrl,
            trackUri: track.trackUri,
            externalUrl: track.externalUrl,
          }
        : {
            trackName: 'Silent',
            artistName: 'Not listening',
            status: 'SILENT',
            isSilent: true,
          }),
    },
  });

  // Link schedule to replay
  await prisma.captureSchedule.update({
    where: { id: scheduleId },
    data: { captureSucceeded: true, replayId: replay.id },
  });

  // Send push notification
  await sendPushNotification(schedule.userId, {
    title: 'Captured!',
    body: track ? `${track.trackName} — ${track.artistName}` : 'Silent Replay',
    data: { type: 'capture', replayId: replay.id, segment: replay.segment },
  });

  return replay;
}
