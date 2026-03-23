import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReplayDetail } from '../../hooks/useReplay';
import { useAuth } from '../../contexts/AuthContext';
import ReactionBar from '../../components/ReactionBar';
import CommentSection from '../../components/CommentSection';
import { colors, spacing, radius, typography } from '../../constants/theme';

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
      {/* User header */}
      {replay.user && (
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {replay.user.displayName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{replay.user.displayName}</Text>
            <Text style={styles.userHandle}>@{replay.user.username}</Text>
          </View>
          {replay.externalUrl && (
            <TouchableOpacity
              style={styles.openSpotify}
              onPress={() => Linking.openURL(replay.externalUrl)}
            >
              <Ionicons name="musical-notes" size={16} color={colors.spotify} />
              <Text style={styles.openSpotifyText}>Open</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Album art */}
      <View style={styles.artContainer}>
        <View style={styles.artGlow} />
        {replay.albumArtUrl ? (
          <Image source={{ uri: replay.albumArtUrl }} style={styles.albumArt} />
        ) : (
          <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
            <Ionicons name="musical-notes" size={64} color={colors.accent} />
          </View>
        )}
      </View>

      {/* Track info */}
      <View style={styles.trackSection}>
        <Text style={styles.trackName}>{replay.trackName}</Text>
        <Text style={styles.artistName}>{replay.artistName}</Text>
        {replay.albumName && (
          <Text style={styles.albumName}>{replay.albumName}</Text>
        )}
      </View>

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

      {/* Divider */}
      <View style={styles.divider} />

      {/* Reaction bar */}
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

      {/* Divider */}
      <View style={styles.divider} />

      {/* Comments */}
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
    fontSize: 14,
  },
  userHandle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  openSpotify: {
    marginLeft: 'auto',
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

  // Album art
  artContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    position: 'relative',
  },
  artGlow: {
    position: 'absolute',
    top: 30,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accentGlow,
  },
  albumArt: {
    width: 260,
    height: 260,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  albumArtPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Track info
  trackSection: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  trackName: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  artistName: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  albumName: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
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
