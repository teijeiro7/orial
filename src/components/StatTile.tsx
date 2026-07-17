import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';

interface StatTileProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}

const TINT_ALPHA_HEX = '2E'; // ~18% opacity

export function StatTile({ icon, value, label, color }: StatTileProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconPill, { backgroundColor: `${color}${TINT_ALPHA_HEX}` }]}>
        {icon}
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.border,
    borderRadius: 16,
    padding: 14,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    ...OrialTypography.headingLarge,
    marginBottom: 2,
  },
  label: {
    ...OrialTypography.caption,
    color: OrialColors.textMuted,
  },
});
