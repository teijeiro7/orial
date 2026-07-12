import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface SectionLabelProps {
  label: string;
}

export function SectionLabel({ label }: SectionLabelProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  dot: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: OrialColors.violetLight,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: OrialColors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});
