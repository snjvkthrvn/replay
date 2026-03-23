import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addReaction, removeReaction } from '../services/api';
import { colors, spacing, radius } from '../constants/theme';

const EMOJIS = [
  { key: 'fire', label: '\uD83D\uDD25' },
  { key: 'heart', label: '\u2764\uFE0F' },
  { key: 'laughing', label: '\uD83D\uDE02' },
  { key: 'music', label: '\uD83C\uDFB5' },
  { key: 'eyes', label: '\uD83D\uDC40' },
  { key: 'raised_hands', label: '\uD83D\uDE4C' },
];

interface ReactionBarProps {
  replayId: string;
  activeReaction?: string | null;
}

export default function ReactionBar({ replayId, activeReaction }: ReactionBarProps) {
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: (emoji: string) => addReaction(replayId, emoji),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replay', replayId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => removeReaction(replayId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['replay', replayId] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handlePress = (emoji: string) => {
    if (activeReaction === emoji) {
      remove.mutate();
    } else {
      add.mutate(emoji);
    }
  };

  return (
    <View style={styles.container}>
      {EMOJIS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.button, activeReaction === key && styles.activeButton]}
          onPress={() => handlePress(key)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeButton: {
    backgroundColor: colors.accentGlow,
    borderColor: colors.accent,
  },
  emoji: {
    fontSize: 20,
  },
});
