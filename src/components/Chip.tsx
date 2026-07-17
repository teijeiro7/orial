import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  chipActive: {
    backgroundColor: OrialColors.violet,
    borderColor: OrialColors.violet,
  },
  label: {
    fontSize: 12,
    color: OrialColors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: OrialColors.textPrimary,
  },
});
