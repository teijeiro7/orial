import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
}

export function PillButton({
  label,
  onPress,
  backgroundColor = OrialColors.violet,
  textColor = OrialColors.textPrimary,
}: PillButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.button, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
