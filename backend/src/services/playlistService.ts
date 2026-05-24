import { Segment } from '@prisma/client';
import axios from 'axios';
import prisma from './prisma';
import { ensureValidToken } from './spotify';
import { isShareableReplayStatus } from './accessControl';

interface PlaylistOptions {
  name: string;
  description?: string;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  segments?: Segment[];
  friendIds?: string[];
}

type PlaylistReplayFilterOptions = Pick<PlaylistOptions, 'timeRangeStart' | 'timeRangeEnd' | 'segments'>;

type UnlockedSegment = {
  segment: Segment;
  segmentDate: Date;
};

function replayBaseWhere(opts: PlaylistReplayFilterOptions) {
  const where: any = {
    segmentDate: { gte: opts.timeRangeStart, lte: opts.timeRangeEnd },
    status: { in: ['CONFIRMED', 'LATE'] },
    isSilent: false,
  };
  if (opts.segments?.length) {
    where.segment = { in: opts.segments };
  }
  return where;
}

export function buildPlaylistReplayWhere(
  userId: string,
  opts: PlaylistReplayFilterOptions,
  friendIds: string[],
  unlockedSegments: UnlockedSegment[],
) {
  const segmentFilter = new Set(opts.segments || []);
  const unlockedMatches = unlockedSegments.filter(({ segment }) =>
    segmentFilter.size === 0 || segmentFilter.has(segment)
  );

  const where = replayBaseWhere(opts);
  where.OR = [{ userId }];

  if (friendIds.length && unlockedMatches.length) {
    where.OR.push({
      userId: { in: friendIds },
      OR: unlockedMatches.map(({ segment, segmentDate }) => ({ segment, segmentDate })),
    });
  }

  return where;
}

async function getAcceptedFriendIds(userId: string, requestedFriendIds: string[] = []) {
  if (!requestedFriendIds.length) return [];

  const friendships = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: userId, addresseeId: { in: requestedFriendIds } },
        { addresseeId: userId, requesterId: { in: requestedFriendIds } },
      ],
    },
  });

  const validFriendIds = new Set(friendships.map(f =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  ));
  return requestedFriendIds.filter(id => validFriendIds.has(id));
}

async function getUnlockedSegments(userId: string, opts: PlaylistReplayFilterOptions): Promise<UnlockedSegment[]> {
  const unlocked = await prisma.replay.findMany({
    where: {
      userId,
      segmentDate: { gte: opts.timeRangeStart, lte: opts.timeRangeEnd },
      ...(opts.segments?.length ? { segment: { in: opts.segments } } : {}),
    },
    select: { segment: true, segmentDate: true, status: true },
  });

  const unique = new Map<string, UnlockedSegment>();
  for (const replay of unlocked) {
    if (!isShareableReplayStatus(replay.status)) continue;
    unique.set(`${replay.segment}:${replay.segmentDate.toISOString()}`, {
      segment: replay.segment,
      segmentDate: replay.segmentDate,
    });
  }
  return [...unique.values()];
}

export async function generatePlaylist(userId: string, opts: PlaylistOptions) {
  const friendIds = await getAcceptedFriendIds(userId, opts.friendIds);
  const unlockedSegments = await getUnlockedSegments(userId, opts);
  const where = buildPlaylistReplayWhere(userId, opts, friendIds, unlockedSegments);

  const replays = await prisma.replay.findMany({
    where,
    orderBy: { captureTime: 'asc' },
  });

  // Deduplicate by trackUri
  const unique = new Map<string, any>();
  for (const r of replays) {
    if (r.trackUri && !unique.has(r.trackUri)) {
      unique.set(r.trackUri, {
        trackUri: r.trackUri,
        trackName: r.trackName,
        artistName: r.artistName,
        albumArtUrl: r.albumArtUrl,
      });
    }
  }
  const tracks = [...unique.values()];

  const playlist = await prisma.playlist.create({
    data: {
      userId,
      name: opts.name,
      description: opts.description,
      timeRangeStart: opts.timeRangeStart,
      timeRangeEnd: opts.timeRangeEnd,
      segmentsIncluded: opts.segments || [],
      friendIdsIncluded: friendIds,
      trackCount: tracks.length,
    },
  });

  return { id: playlist.id, name: playlist.name, trackCount: tracks.length, tracks };
}

export async function exportToSpotify(userId: string, playlistId: string) {
  const playlist = await prisma.playlist.findFirstOrThrow({
    where: { id: playlistId, userId },
    include: { user: true },
  });

  const opts = {
    timeRangeStart: playlist.timeRangeStart!,
    timeRangeEnd: playlist.timeRangeEnd!,
    segments: playlist.segmentsIncluded.length ? playlist.segmentsIncluded : undefined,
  };
  const friendIds = await getAcceptedFriendIds(userId, playlist.friendIdsIncluded);
  const unlockedSegments = await getUnlockedSegments(userId, opts);
  const where = {
    ...buildPlaylistReplayWhere(userId, opts, friendIds, unlockedSegments),
    trackUri: { not: null },
  };

  const replays = await prisma.replay.findMany({
    where,
  });

  const uris = [...new Set(replays.map(r => r.trackUri!))];

  // Ensure valid Spotify token before API calls
  const accessToken = await ensureValidToken(playlist.user);

  // Create Spotify playlist
  const { data: created } = await axios.post(
    `https://api.spotify.com/v1/users/${playlist.user.musicServiceUserId}/playlists`,
    { name: playlist.name, description: playlist.description || 'Generated by Replay', public: false },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  // Add tracks in batches of 100
  for (let i = 0; i < uris.length; i += 100) {
    await axios.post(
      `https://api.spotify.com/v1/playlists/${created.id}/tracks`,
      { uris: uris.slice(i, i + 100) },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  await prisma.playlist.update({
    where: { id: playlistId },
    data: {
      exportedTo: 'SPOTIFY',
      externalPlaylistId: created.id,
      externalPlaylistUrl: created.external_urls.spotify,
    },
  });

  return {
    externalPlaylistId: created.id,
    externalPlaylistUrl: created.external_urls.spotify,
    trackCount: uris.length,
  };
}
