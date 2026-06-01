import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../../utils/colors';

interface StrainBarProps {
  strain: number; // 0-21 scale
  compact?: boolean;
}

export function StrainBar({ strain, compact = false }: StrainBarProps) {
  const pct = Math.min(100, (strain / 21) * 100);

  const color = strain >= 15
    ? OrialColors.error
    : strain >= 10
    ? OrialColors.warning
    : OrialColors.success;

  if (compact) {
    return (
      <View style={styles.compactBar}>
        <View style={[styles.compactFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      <Text style={styles.label}>{strain.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    position: 'absolute',
    right: 6,
    top: -1,
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    color: OrialColors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  compactBar: {
    width: 48,
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: 3,
  },
});