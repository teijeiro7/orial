import React from 'react';
import { View, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface ProgressBarProps {
  pct: number;
  color: string;
}

export function ProgressBar({ pct, color }: ProgressBarProps) {
  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clampedPct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    backgroundColor: OrialColors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
