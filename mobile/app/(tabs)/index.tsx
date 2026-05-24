import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFeed } from '../../hooks/useFeed';
import ReplayCard from '../../components/ReplayCard';
import { colors, spacing, radius, typography } from '../../constants/theme';
import { AlbumArt, WaveformBars } from '../../components/ReplayVisuals';

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
const SEGMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MORNING: 'sunny-outline',
  AFTERNOON: 'partly-sunny-outline',
  NIGHT: 'moon-outline',
  LATE_NIGHT: 'sparkles-outline',
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
  const router = useRouter();
  const friendReplays = data?.friendReplays || [];
  const captured = friendReplays.filter((item: any) => item.status !== 'MISSED').length;
  const total = data?.locked ? data.friendCount || 0 : friendReplays.length;

  return (
    <View style={styles.container}>
      <FeedHeader segment={segment} captured={captured} total={total} />
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
          data={friendReplays}
          keyExtractor={(item: any) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.tileRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <ListHeader
              userReplay={data?.userReplay}
              total={total}
              onPressCapture={() => router.push('/(tabs)/pending')}
            />
          }
          renderItem={({ item }) => <ReplayCard replay={item} variant="mosaic" />}
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {SEGMENTS.map((s) => {
          const active = segment === s;
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSelect(s)}
              style={[styles.tab, active && styles.activeTab]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={SEGMENT_ICONS[s]}
                size={14}
                color={active ? colors.bg : colors.textSecondary}
              />
              <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>
                {SEGMENT_LABELS[s]}
              </Text>
              {active && (
                <Text style={[styles.tabTime, active && styles.activeTabTime]}>
                  {SEGMENT_TIMES[s]}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function FeedHeader({
  segment,
  captured,
  total,
}: {
  segment: string;
  captured: number;
  total: number;
}) {
  const today = new Date().toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.feedHeader}>
      <View style={styles.feedHeaderTop}>
        <View>
          <Text style={styles.dateLabel}>{today}</Text>
          <Text style={styles.segmentTitle}>
            {SEGMENT_LABELS[segment].toLowerCase()}
            <Text style={styles.segmentDot}>.</Text>
          </Text>
        </View>
        <View style={styles.profileDot}>
          <Text style={styles.profileDotText}>J</Text>
        </View>
      </View>
      <View style={styles.liveStrip}>
        <View style={styles.livePulse} />
        <Text style={styles.liveText}>
          <Text style={styles.liveTextStrong}>{captured}/{Math.max(total, captured)}</Text>
          {' '}captured · reveals soon
        </Text>
        <Text style={styles.liveTime}>{SEGMENT_TIMES[segment]}</Text>
      </View>
    </View>
  );
}

function ListHeader({
  userReplay,
  total,
  onPressCapture,
}: {
  userReplay?: any;
  total: number;
  onPressCapture: () => void;
}) {
  return (
    <View>
      {userReplay ? (
        <TouchableOpacity
          style={styles.myReplayOuter}
          onPress={onPressCapture}
          activeOpacity={0.84}
        >
          <LinearGradient
            colors={['rgba(200,149,108,0.28)', 'rgba(200,149,108,0.04)', 'rgba(200,149,108,0.14)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.myReplayGradient}
          >
            <View style={styles.myReplayCard}>
              <AlbumArt
                url={userReplay.albumArtUrl}
                seed={`${userReplay.id || 'mine'}-${userReplay.trackName}`}
                size={96}
                borderRadius={0}
                style={styles.myReplayArt}
              />
              <View style={styles.myReplayInfo}>
                <Text style={styles.myReplayLabel}>YOU · LOCKED IN</Text>
                <Text style={styles.myReplayTrack} numberOfLines={1}>
                  {userReplay.trackName}
                </Text>
                <Text style={styles.myReplayArtist} numberOfLines={1}>
                  {userReplay.artistName}
                </Text>
                <View style={styles.waveRow}>
                  <WaveformBars color={colors.confirmed} active count={10} height={16} />
                  <Text style={styles.lockedText}>CONFIRMED</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>FRIENDS · {total}</Text>
        <View style={styles.sectionRule} />
        <Text style={styles.sectionLive}>LIVE</Text>
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  tileRow: {
    justifyContent: 'space-between',
  },

  // Header
  feedHeader: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  feedHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dateLabel: {
    ...typography.micro,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  segmentTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1.2,
    marginTop: 2,
  },
  segmentDot: {
    color: colors.accent,
  },
  profileDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDotText: {
    color: colors.accent,
    fontWeight: '800',
  },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  liveText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  liveTextStrong: {
    color: colors.text,
  },
  liveTime: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
  },

  // Segment tabs
  tabsContainer: {
    paddingBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  activeTab: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: -0.2,
  },
  activeTabLabel: {
    color: colors.bg,
  },
  tabTime: {
    fontSize: 9,
    color: colors.bg,
    opacity: 0.55,
    fontWeight: '700',
  },
  activeTabTime: {
    color: colors.bg,
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
  myReplayOuter: {
    margin: spacing.xs,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  myReplayGradient: {
    padding: 2,
  },
  myReplayCard: {
    flexDirection: 'row',
    minHeight: 98,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  myReplayInfo: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  myReplayArt: {
    height: 98,
  },
  myReplayLabel: {
    ...typography.micro,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  myReplayTrack: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  myReplayArtist: {
    ...typography.caption,
    marginTop: 2,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  lockedText: {
    color: colors.confirmed,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textTertiary,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  sectionLive: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
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
