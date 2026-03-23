import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../constants/theme';

interface ReplayCardProps {
  replay: {
    id: string;
    user?: { displayName: string; username: string };
    trackName: string;
    artistName: string;
    albumName?: string;
    albumArtUrl?: string;
    captureTime: string;
    status: string;
    reRollsUsed: number;
    reactionCount: number;
    commentCount: number;
  };
  onPress?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CONFIRMED: { label: 'Confirmed', color: colors.confirmed, bg: colors.confirmedBg, icon: 'checkmark-circle' },
  LATE: { label: 'Late', color: colors.late, bg: colors.lateBg, icon: 'time' },
  SILENT: { label: 'Silent', color: colors.silent, bg: colors.silentBg, icon: 'volume-mute' },
  MISSED: { label: 'Missed', color: colors.missed, bg: colors.missedBg, icon: 'close-circle' },
};

export default function ReplayCard({ replay, onPress }: ReplayCardProps) {
  const router = useRouter();
  const status = STATUS_CONFIG[replay.status];
  const handlePress = onPress || (() => router.push(`/replay/${replay.id}`));
  const captureTime = new Date(replay.captureTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Album art */}
      {replay.albumArtUrl ? (
        <Image source={{ uri: replay.albumArtUrl }} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.placeholder]}>
          <Ionicons name="musical-notes" size={24} color={colors.accent} />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        {replay.user && (
          <Text style={styles.userName}>{replay.user.displayName}</Text>
        )}
        <Text style={styles.trackName} numberOfLines={1}>
          {replay.trackName}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {replay.artistName}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.time}>{captureTime}</Text>

          {status && (
            <View style={[styles.badge, { backgroundColor: status.bg }]}>
              <Ionicons name={status.icon as any} size={10} color={status.color} />
              <Text style={[styles.badgeText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          )}

          {replay.reRollsUsed > 0 && (
            <View style={styles.rerolledPill}>
              <Ionicons name="shuffle" size={10} color={colors.late} />
            </View>
          )}
        </View>

        {(replay.reactionCount > 0 || replay.commentCount > 0) && (
          <View style={styles.engagement}>
            {replay.reactionCount > 0 && (
              <View style={styles.engagementItem}>
                <Ionicons name="flame" size={12} color={colors.textTertiary} />
                <Text style={styles.engagementText}>{replay.reactionCount}</Text>
              </View>
            )}
            {replay.commentCount > 0 && (
              <View style={styles.engagementItem}>
                <Ionicons name="chatbubble" size={11} color={colors.textTertiary} />
                <Text style={styles.engagementText}>{replay.commentCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  albumArt: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
  },
  placeholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  info: {
    marginLeft: spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  trackName: {
    ...typography.bodyBold,
  },
  artistName: {
    ...typography.caption,
    marginTop: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  time: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rerolledPill: {
    backgroundColor: colors.lateBg,
    padding: 3,
    borderRadius: radius.sm,
  },
  engagement: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  engagementText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
});
