import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFeed } from '../../hooks/useFeed';
import ReplayCard from '../../components/ReplayCard';
import { colors, spacing, radius, typography } from '../../constants/theme';

const SEGMENTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'LATE_NIGHT'];
const SEGMENT_LABELS: Record<string, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  NIGHT: 'Night',
  LATE_NIGHT: 'Late Night',
};
const SEGMENT_TIMES: Record<string, string> = {
  MORNING: '6a\u2013noon',
  AFTERNOON: 'noon\u20137p',
  NIGHT: '7p\u201311p',
  LATE_NIGHT: '11p\u20133a',
};

function getCurrentSegment(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 19) return 'AFTERNOON';
  if (hour >= 19 && hour < 23) return 'NIGHT';
  return 'LATE_NIGHT';
}

export default function FeedScreen() {
  const [segment, setSegment] = useState(getCurrentSegment);
  const { data, isLoading, refetch } = useFeed(segment);

  return (
    <View style={styles.container}>
      <SegmentTabs segment={segment} onSelect={setSegment} />

      {isLoading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : data?.locked ? (
        <View style={styles.center}>
          <View style={styles.lockContainer}>
            <View style={styles.lockIconCircle}>
              <Text style={styles.lockIcon}>&#x1F512;</Text>
            </View>
            <Text style={styles.lockedTitle}>Feed Locked</Text>
            <Text style={styles.lockedMessage}>{data.message}</Text>
            <View style={styles.friendCountPill}>
              <Text style={styles.friendCountText}>
                {data.friendCount} friend{data.friendCount !== 1 ? 's' : ''} waiting
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={data?.friendReplays || []}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            data?.userReplay ? (
              <View style={styles.myReplayCard}>
                <Text style={styles.myReplayLabel}>YOUR REPLAY</Text>
                <View style={styles.myReplayContent}>
                  <View style={styles.myReplayArt}>
                    <Text style={styles.myReplayArtText}>
                      {data.userReplay.albumArtUrl ? '' : '\u266B'}
                    </Text>
                  </View>
                  <View style={styles.myReplayInfo}>
                    <Text style={styles.myReplayTrack} numberOfLines={1}>
                      {data.userReplay.trackName}
                    </Text>
                    <Text style={styles.myReplayArtist} numberOfLines={1}>
                      {data.userReplay.artistName}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => <ReplayCard replay={item} />}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{'\u266A'}</Text>
              <Text style={styles.emptyTitle}>No friend replays yet</Text>
              <Text style={styles.emptySubtitle}>
                Waiting for your friends to confirm their captures
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SegmentTabs({
  segment,
  onSelect,
}: {
  segment: string;
  onSelect: (s: string) => void;
}) {
  return (
    <View style={styles.tabsContainer}>
      <View style={styles.tabs}>
        {SEGMENTS.map((s) => {
          const active = segment === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSelect(s)}
              style={[styles.tab, active && styles.activeTab]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>
                {SEGMENT_LABELS[s]}
              </Text>
              <Text style={[styles.tabTime, active && styles.activeTabTime]}>
                {SEGMENT_TIMES[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  loadingText: {
    ...typography.caption,
  },
  list: {
    paddingBottom: spacing.xxxl,
  },

  // Segment tabs
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tabs: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: -0.2,
  },
  activeTabLabel: {
    color: colors.accent,
  },
  tabTime: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
    opacity: 0.6,
  },
  activeTabTime: {
    color: colors.accentMuted,
    opacity: 1,
  },

  // Lock state
  lockContainer: {
    alignItems: 'center',
  },
  lockIconCircle: {
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
  lockIcon: {
    fontSize: 32,
  },
  lockedTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  lockedMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  friendCountPill: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  friendCountText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // My replay
  myReplayCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  myReplayLabel: {
    ...typography.micro,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  myReplayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myReplayArt: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  myReplayArtText: {
    fontSize: 20,
    color: colors.accent,
  },
  myReplayInfo: {
    flex: 1,
  },
  myReplayTrack: {
    ...typography.bodyBold,
  },
  myReplayArtist: {
    ...typography.caption,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.massive,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 40,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
});
