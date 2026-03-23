import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { getMe, getSpotifyAuthUrl, spotifyCallback } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function ProfileScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  });

  const connectSpotify = async () => {
    try {
      const { authUrl } = await getSpotifyAuthUrl();
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'replay://');
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        if (code) {
          await spotifyCallback(code);
          qc.invalidateQueries({ queryKey: ['me'] });
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to connect Spotify');
    }
  };

  if (isLoading || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isSpotifyConnected =
    user.musicServiceUserId && user.musicServiceUserId !== 'pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        </View>
        {user.curatorBadge && (
          <View style={styles.curatorBadge}>
            <Ionicons name="star" size={12} color={colors.bg} />
          </View>
        )}
      </View>

      <Text style={styles.displayName}>{user.displayName}</Text>
      <Text style={styles.username}>@{user.username}</Text>
      {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{user.totalReplays}</Text>
          <Text style={styles.statLabel}>REPLAYS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{user.totalFriends}</Text>
          <Text style={styles.statLabel}>FRIENDS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{user.curatorStreak}</Text>
          <Text style={styles.statLabel}>STREAK</Text>
        </View>
      </View>

      {user.curatorBadge && (
        <View style={styles.curatorPill}>
          <Ionicons name="star" size={14} color={colors.accent} />
          <Text style={styles.curatorText}>Curator</Text>
        </View>
      )}

      {/* Menu */}
      <View style={styles.menu}>
        <MenuItem
          icon="people-outline"
          label="Friends"
          onPress={() => router.push('/friends')}
        />
        <MenuItem
          icon={isSpotifyConnected ? 'checkmark-circle' : 'musical-note'}
          label={isSpotifyConnected ? 'Spotify Connected' : 'Connect Spotify'}
          accent={isSpotifyConnected}
          onPress={isSpotifyConnected ? undefined : connectSpotify}
        />
        <MenuItem
          icon="log-out-outline"
          label="Sign Out"
          destructive
          onPress={logout}
        />
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  accent,
  destructive,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  accent?: boolean;
  destructive?: boolean;
}) {
  const textColor = destructive
    ? colors.error
    : accent
    ? colors.spotify
    : colors.text;
  const iconColor = destructive
    ? colors.error
    : accent
    ? colors.spotify
    : colors.textSecondary;

  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Ionicons name={icon as any} size={20} color={iconColor} />
      <Text style={[styles.menuText, { color: textColor }]}>{label}</Text>
      {onPress && !destructive && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textTertiary}
          style={{ marginLeft: 'auto' }}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    alignItems: 'center',
    padding: spacing.xxxl,
    paddingTop: spacing.huge,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    ...typography.caption,
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.accent,
    padding: 3,
  },
  avatar: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.accent,
  },
  curatorBadge: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },

  // Profile info
  displayName: {
    ...typography.h1,
    marginBottom: 2,
  },
  username: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bio: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: spacing.xxl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  statLabel: {
    ...typography.micro,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.xs,
  },

  // Curator
  curatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  curatorText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },

  // Menu
  menu: {
    width: '100%',
    marginTop: spacing.xxxl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
