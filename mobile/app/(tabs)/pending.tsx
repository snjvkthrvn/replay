import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePendingReplay, useConfirmReplay, useRerollReplay } from '../../hooks/useReplay';
import { colors, spacing, radius, typography, gradients } from '../../constants/theme';

export default function PendingScreen() {
  const { data, isLoading, error } = usePendingReplay();
  const confirm = useConfirmReplay();
  const reroll = useRerollReplay();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error || !data?.replay) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="radio-outline" size={36} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No pending captures</Text>
        <Text style={styles.emptySubtitle}>
          We'll capture what you're listening to{'\n'}at a random moment
        </Text>
      </View>
    );
  }

  const { replay, segment, segmentEndsAt } = data;
  const rerollsLeft = replay.reRollsAvailable - replay.reRollsUsed;
  const isGracePeriod = segmentEndsAt && new Date() > new Date(segmentEndsAt);

  return (
    <View style={styles.container}>
      {isGracePeriod && (
        <View style={styles.graceBanner}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text style={styles.graceText}>
            Grace period — confirm now or it'll be missed
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.segmentLabel}>
          {segment.replace('_', ' ')} REPLAY
        </Text>

        {/* Album art with glow */}
        <View style={styles.artContainer}>
          <View style={styles.artGlow} />
          {replay.albumArtUrl ? (
            <Image source={{ uri: replay.albumArtUrl }} style={styles.albumArt} />
          ) : (
            <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
              <Ionicons name="musical-notes" size={56} color={colors.accent} />
            </View>
          )}
        </View>

        {/* Track info */}
        <Text style={styles.trackName}>{replay.trackName}</Text>
        <Text style={styles.artistName}>{replay.artistName}</Text>
        {replay.albumName ? (
          <Text style={styles.albumName}>{replay.albumName}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {new Date(replay.captureTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {rerollsLeft} re-roll{rerollsLeft !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={() => confirm.mutate(replay.id)}
            disabled={confirm.isPending}
            activeOpacity={0.85}
            style={styles.confirmOuter}
          >
            <LinearGradient
              colors={gradients.accentButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmButton}
            >
              {confirm.isPending ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.bg} />
                  <Text style={styles.confirmText}>Confirm</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {rerollsLeft > 0 && (
            <TouchableOpacity
              style={styles.rerollButton}
              onPress={() => reroll.mutate(replay.id)}
              disabled={reroll.isPending}
              activeOpacity={0.7}
            >
              {reroll.isPending ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <>
                  <Ionicons name="shuffle" size={18} color={colors.accent} />
                  <Text style={styles.rerollText}>Re-roll</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {(confirm.error || reroll.error) && (
          <Text style={styles.errorText}>
            {(confirm.error as any)?.response?.data?.error ||
              (reroll.error as any)?.response?.data?.error ||
              'Something went wrong'}
          </Text>
        )}

        {segmentEndsAt && (
          <Text style={styles.deadline}>
            Segment ends{' '}
            {new Date(segmentEndsAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xxxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },

  // Grace period
  graceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 160, 74, 0.15)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  graceText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },

  // Empty state
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Segment
  segmentLabel: {
    ...typography.micro,
    color: colors.accent,
    marginBottom: spacing.xxl,
  },

  // Album art
  artContainer: {
    position: 'relative',
    marginBottom: spacing.xxxl,
  },
  artGlow: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: -10,
    borderRadius: 140,
    backgroundColor: colors.accentGlowStrong,
  },
  albumArt: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
    borderColor: colors.cardBorder,
  },
  albumArtPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Track info
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
  },

  // Meta pills
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xxxl,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Buttons
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  confirmOuter: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.md,
  },
  confirmText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rerollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  rerollText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },

  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  deadline: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxl,
  },
});
