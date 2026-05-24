import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useReplayDetail } from '../../hooks/useReplay';
import { useAuth } from '../../contexts/AuthContext';
import ReactionBar from '../../components/ReactionBar';
import CommentSection from '../../components/CommentSection';
import { colors, spacing, radius, typography } from '../../constants/theme';
import { AlbumArt, WaveformBars } from '../../components/ReplayVisuals';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: 'Confirmed', color: colors.confirmed, bg: colors.confirmedBg },
  LATE: { label: 'Late', color: colors.late, bg: colors.lateBg },
  SILENT: { label: 'Silent', color: colors.silent, bg: colors.silentBg },
  MISSED: { label: 'Missed', color: colors.missed, bg: colors.missedBg },
};

export default function ReplayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: replay, isLoading, error } = useReplayDetail(id);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !replay) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} />
        <Text style={styles.errorText}>Replay not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = STATUS_CONFIG[replay.status];
  const captureTime = new Date(replay.captureTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const captureDate = new Date(replay.captureTime).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // Find current user's reaction if any
  const myReaction = replay.reactions?.find(
    (r: any) => r.userId === user?.id
  )?.emoji || null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroColorWash} />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(8,8,10,0.4)', colors.bg]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroActions}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={16} color={colors.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          {replay.externalUrl && (
            <TouchableOpacity
              style={styles.openSpotify}
              onPress={() => Linking.openURL(replay.externalUrl)}
            >
              <Ionicons name="musical-notes" size={15} color={colors.spotify} />
              <Text style={styles.openSpotifyText}>Open</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.heroContent}>
          <AlbumArt
            url={replay.albumArtUrl}
            seed={`${replay.id}-${replay.trackName}`}
            size={86}
            borderRadius={radius.lg}
            style={styles.heroArt}
          />
          <View style={styles.heroCopy}>
            {replay.user && (
              <Text style={styles.userName} numberOfLines={1}>
                {replay.user.displayName}
              </Text>
            )}
            <Text style={styles.trackName} numberOfLines={2}>
              {replay.trackName}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {replay.artistName}
            </Text>
            {replay.albumName && (
              <Text style={styles.albumName} numberOfLines={1}>
                {replay.albumName}
              </Text>
            )}
          </View>
        </View>
      </View>

      {replay.user && (
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {replay.user.displayName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.userHandle}>@{replay.user.username}</Text>
          </View>
          <View style={styles.detailWave}>
            <WaveformBars color={colors.accent} active={!!myReaction} count={9} height={16} />
          </View>
        </View>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.metaText}>{captureTime}</Text>
        </View>
        <View style={styles.metaDot} />
        <Text style={styles.metaText}>{captureDate}</Text>
        {status && (
          <>
            <View style={styles.metaDot} />
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </>
        )}
        {replay.reRollsUsed > 0 && (
          <>
            <View style={styles.metaDot} />
            <View style={styles.rerolledBadge}>
              <Ionicons name="shuffle" size={11} color={colors.late} />
              <Text style={styles.rerolledText}>Re-rolled</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>REACTIONS</Text>
      <ReactionBar replayId={replay.id} activeReaction={myReaction} />

      {/* Reaction summary */}
      {replay.reactions?.length > 0 && (
        <View style={styles.reactionSummary}>
          {Object.entries(
            replay.reactions.reduce((acc: Record<string, number>, r: any) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {})
          ).map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionChip}>
              <Text style={styles.reactionEmoji}>
                {emojiChar(emoji)}
              </Text>
              <Text style={styles.reactionCount}>{count as number}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      <CommentSection
        replayId={replay.id}
        comments={replay.comments || []}
        currentUsername={user?.username}
      />
    </ScrollView>
  );
}

function emojiChar(key: string): string {
  const map: Record<string, string> = {
    fire: '\uD83D\uDD25',
    heart: '\u2764\uFE0F',
    laughing: '\uD83D\uDE02',
    music: '\uD83C\uDFB5',
    eyes: '\uD83D\uDC40',
    raised_hands: '\uD83D\uDE4C',
  };
  return map[key] || key;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  backLink: {
    marginTop: spacing.sm,
  },
  backLinkText: {
    color: colors.accent,
    fontSize: 15,
  },

  hero: {
    height: 270,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroColorWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentGlowStrong,
  },
  heroActions: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  heroArt: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },

  // User header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.accent,
  },
  userName: {
    ...typography.bodyBold,
    color: colors.accent,
    marginBottom: 3,
  },
  userHandle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  openSpotify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.spotifyDim,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.25)',
  },
  openSpotifyText: {
    color: colors.spotify,
    fontWeight: '600',
    fontSize: 13,
  },
  detailWave: {
    marginLeft: 'auto',
  },
  trackName: {
    ...typography.h1,
    fontSize: 24,
    textAlign: 'left',
    marginBottom: spacing.xs,
  },
  artistName: {
    ...typography.body,
    color: colors.textSecondary,
  },
  albumName: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textTertiary,
    opacity: 0.4,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rerolledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.lateBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  rerolledText: {
    fontSize: 11,
    color: colors.late,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...typography.micro,
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Reaction summary
  reactionSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
