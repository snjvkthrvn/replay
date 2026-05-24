import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, typography } from '../constants/theme';
import { AlbumArt } from './ReplayVisuals';

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
  variant?: 'stack' | 'mosaic' | 'grid';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  CONFIRMED: { label: 'Confirmed', color: colors.confirmed, bg: colors.confirmedBg, icon: 'checkmark-circle' },
  LATE: { label: 'Late', color: colors.late, bg: colors.lateBg, icon: 'time' },
  SILENT: { label: 'Silent', color: colors.silent, bg: colors.silentBg, icon: 'volume-mute' },
  MISSED: { label: 'Missed', color: colors.missed, bg: colors.missedBg, icon: 'close-circle' },
};

export default function ReplayCard({ replay, onPress, variant = 'stack' }: ReplayCardProps) {
  const router = useRouter();
  const status = STATUS_CONFIG[replay.status];
  const handlePress = onPress || (() => router.push(`/replay/${replay.id}`));
  const captureTime = new Date(replay.captureTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const seed = `${replay.id}-${replay.trackName}-${replay.artistName}`;

  if (variant === 'mosaic' || variant === 'grid') {
    const compact = variant === 'grid';
    return (
      <TouchableOpacity
        style={[styles.tile, compact && styles.gridTile]}
        onPress={handlePress}
        activeOpacity={0.82}
      >
        <AlbumArt
          url={replay.albumArtUrl}
          seed={seed}
          size="100%"
          borderRadius={compact ? radius.md : radius.lg}
          style={styles.tileArt}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.44, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.tileStatusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: status?.color || colors.textTertiary },
            ]}
          />
          {!compact && <Text style={styles.tileTime}>{captureTime.replace(/\s[AP]M/, '')}</Text>}
        </View>
        {replay.reRollsUsed > 0 && !compact && (
          <View style={styles.tileReroll}>
            <Ionicons name="refresh" size={10} color={colors.late} />
            <Text style={styles.tileRerollText}>{replay.reRollsUsed}</Text>
          </View>
        )}
        <View style={styles.tileCopy}>
          {replay.user && (
            <Text style={styles.tileUser} numberOfLines={1}>
              {replay.user.displayName}
            </Text>
          )}
          {!compact && (
            <>
              <Text style={styles.tileTrack} numberOfLines={1}>
                {replay.trackName}
              </Text>
              <Text style={styles.tileArtist} numberOfLines={1}>
                {replay.artistName}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <AlbumArt url={replay.albumArtUrl} seed={seed} size={72} borderRadius={radius.md} />

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
              <Ionicons name="refresh" size={10} color={colors.late} />
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
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    margin: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  gridTile: {
    borderRadius: radius.md,
    margin: 3,
  },
  tileArt: {
    ...StyleSheet.absoluteFillObject,
  },
  tileStatusRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tileTime: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tileReroll: {
    position: 'absolute',
    top: 9,
    right: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.46)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tileRerollText: {
    color: colors.late,
    fontSize: 9,
    fontWeight: '700',
  },
  tileCopy: {
    position: 'absolute',
    left: 11,
    right: 11,
    bottom: 10,
  },
  tileUser: {
    color: colors.accentLight,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  tileTrack: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tileArtist: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    marginTop: 1,
  },
});
