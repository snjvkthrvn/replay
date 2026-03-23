import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useFriends,
  usePendingRequests,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useSearchUsers,
} from '../hooks/useFriends';
import { colors, spacing, radius, typography } from '../constants/theme';

export default function FriendsScreen() {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(
          [
            { key: 'friends', label: 'Friends', icon: 'people-outline' },
            { key: 'requests', label: 'Requests', icon: 'mail-outline' },
            { key: 'search', label: 'Search', icon: 'search-outline' },
          ] as const
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.activeTab]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={t.icon as any}
              size={16}
              color={tab === t.key ? colors.accent : colors.textTertiary}
            />
            <Text
              style={[styles.tabText, tab === t.key && styles.activeTabText]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' && <FriendsList />}
      {tab === 'requests' && <RequestsList />}
      {tab === 'search' && (
        <SearchTab query={searchQuery} onQueryChange={setSearchQuery} />
      )}
    </View>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name?.[0]?.toUpperCase()}</Text>
    </View>
  );
}

function FriendsList() {
  const { data, isLoading } = useFriends();

  if (isLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );

  return (
    <FlatList
      data={data?.friends || []}
      keyExtractor={(item: any) => item.friendshipId || item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.listItem}>
          <UserAvatar name={item.displayName} />
          <View style={styles.userInfo}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.username}>@{item.username}</Text>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons
            name="people-outline"
            size={36}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>No friends yet</Text>
          <Text style={styles.emptySubtext}>
            Search for people to add
          </Text>
        </View>
      }
    />
  );
}

function RequestsList() {
  const { data, isLoading } = usePendingRequests();
  const accept = useAcceptFriendRequest();
  const reject = useRejectFriendRequest();

  if (isLoading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );

  return (
    <FlatList
      data={data?.friends || []}
      keyExtractor={(item: any) => item.friendshipId || item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.listItem}>
          <UserAvatar name={item.displayName} />
          <View style={[styles.userInfo, { flex: 1 }]}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.username}>@{item.username}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => accept.mutate(item.friendshipId)}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={16} color={colors.bg} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => reject.mutate(item.friendshipId)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons
            name="mail-outline"
            size={36}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>No pending requests</Text>
        </View>
      }
    />
  );
}

function SearchTab({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const { data, isLoading } = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrapper}>
        <Ionicons
          name="search"
          size={18}
          color={colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={data?.users || []}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <UserAvatar name={item.displayName} />
            <View style={[styles.userInfo, { flex: 1 }]}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            {item.isFriend ? (
              <View style={styles.friendBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.spotify}
                />
                <Text style={styles.friendBadgeText}>Friends</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => sendRequest.mutate(item.username)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add" size={14} color={colors.bg} />
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          query.length >= 2 && !isLoading ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : null
        }
      />
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
    gap: spacing.md,
  },
  list: {
    paddingVertical: spacing.sm,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  activeTabText: {
    color: colors.accent,
  },

  // Search
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },

  // List items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  userInfo: {},
  name: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  username: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  addText: {
    color: colors.bg,
    fontWeight: '700',
    fontSize: 12,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  friendBadgeText: {
    color: colors.spotify,
    fontWeight: '600',
    fontSize: 12,
  },

  // Empty
  emptyText: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  emptySubtext: {
    ...typography.caption,
  },
});
