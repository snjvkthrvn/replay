import { ReplayStatus, Segment } from '@prisma/client';
import prisma from './prisma';
import { getRevealTime } from './segments';

type ReplayAccessSnapshot = {
  userId: string;
  segment: Segment | string;
  segmentDate: Date;
  status: ReplayStatus | string;
};

type ReplayAccessDecision = {
  viewerId: string;
  replay: ReplayAccessSnapshot;
  areFriends: boolean;
  viewerUnlockedSegment: boolean;
  segmentRevealed?: boolean;
};

const SHAREABLE_STATUSES = new Set<string>(['CONFIRMED', 'LATE', 'SILENT']);

export function isShareableReplayStatus(status: ReplayStatus | string): boolean {
  return SHAREABLE_STATUSES.has(status);
}

export function canViewReplay(decision: ReplayAccessDecision): boolean {
  if (decision.viewerId === decision.replay.userId) return true;
  return (
    decision.areFriends &&
    decision.viewerUnlockedSegment &&
    decision.segmentRevealed !== false &&
    isShareableReplayStatus(decision.replay.status)
  );
}

export function canInteractWithReplay(decision: ReplayAccessDecision): boolean {
  if (!isShareableReplayStatus(decision.replay.status)) return false;
  if (decision.segmentRevealed === false) return false;
  if (decision.viewerId === decision.replay.userId) return true;
  return decision.areFriends && decision.viewerUnlockedSegment;
}

export async function areAcceptedFriends(userA: string, userB: string): Promise<boolean> {
  if (userA === userB) return true;
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userA, addresseeId: userB },
        { requesterId: userB, addresseeId: userA },
      ],
    },
    select: { id: true },
  });
  return Boolean(friendship);
}

export async function hasUnlockedSegment(
  userId: string,
  segment: Segment | string,
  segmentDate: Date,
): Promise<boolean> {
  const replay = await prisma.replay.findUnique({
    where: {
      userId_segmentDate_segment: {
        userId,
        segmentDate,
        segment: segment as Segment,
      },
    },
    select: { status: true },
  });
  return Boolean(replay && isShareableReplayStatus(replay.status));
}

async function buildAccessDecision(viewerId: string, replay: ReplayAccessSnapshot) {
  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: { timezone: true },
  });
  const segmentRevealed = viewer
    ? new Date() >= getRevealTime(replay.segment as Segment, replay.segmentDate, viewer.timezone)
    : false;

  if (viewerId === replay.userId) {
    return {
      viewerId,
      replay,
      areFriends: true,
      viewerUnlockedSegment: true,
      segmentRevealed,
    };
  }

  const [friends, unlocked] = await Promise.all([
    areAcceptedFriends(viewerId, replay.userId),
    hasUnlockedSegment(viewerId, replay.segment, replay.segmentDate),
  ]);

  return {
    viewerId,
    replay,
    areFriends: friends,
    viewerUnlockedSegment: unlocked,
    segmentRevealed,
  };
}

export async function canViewerReadReplay(viewerId: string, replay: ReplayAccessSnapshot) {
  return canViewReplay(await buildAccessDecision(viewerId, replay));
}

export async function canViewerInteractWithReplay(viewerId: string, replay: ReplayAccessSnapshot) {
  return canInteractWithReplay(await buildAccessDecision(viewerId, replay));
}
