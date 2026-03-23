import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addComment, deleteComment } from '../services/api';
import { colors, spacing, radius, typography } from '../constants/theme';

interface Comment {
  id: string;
  text: string;
  user: { username: string; displayName: string };
  createdAt: string;
}

interface CommentSectionProps {
  replayId: string;
  comments: Comment[];
  currentUsername?: string;
}

export default function CommentSection({
  replayId,
  comments,
  currentUsername,
}: CommentSectionProps) {
  const [text, setText] = useState('');
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: () => addComment(replayId, text),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['replay', replayId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replay', replayId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Comments ({comments.length})</Text>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <View style={styles.commentAvatar}>
              <Text style={styles.commentAvatarText}>
                {item.user.displayName[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentUser}>{item.user.displayName}</Text>
                <Text style={styles.commentTime}>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.commentText}>{item.text}</Text>
            </View>
            {currentUsername && item.user.username === currentUsername && (
              <TouchableOpacity
                onPress={() => remove.mutate(item.id)}
                disabled={remove.isPending}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={() => add.mutate()}
          disabled={!text.trim() || add.isPending}
        >
          <Ionicons
            name="arrow-up"
            size={18}
            color={text.trim() ? colors.bg : colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
  },
  header: {
    ...typography.bodyBold,
    marginBottom: spacing.md,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  commentAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  commentBody: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  commentUser: {
    fontWeight: '600',
    fontSize: 12,
    color: colors.text,
  },
  commentTime: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  commentText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    borderRadius: radius.full,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sendText: {
    color: colors.bg,
    fontWeight: '600',
    fontSize: 14,
  },
});
