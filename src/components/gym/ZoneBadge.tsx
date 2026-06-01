import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../../utils/colors';

interface ZoneBadgeProps {
  zone: number; // 1-5
  pct: number;
}

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const ZONE_COLORS = ['#64748B', '#22C55E', '#F59E0B', '#EF4444', '#DC2626'];

export function ZoneBadge({ zone, pct }: ZoneBadgeProps) {
  return (
    <View style={[styles.badge, { borderColor: ZONE_COLORS[zone - 1] }]}>
      <Text style={[styles.label, { color: ZONE_COLORS[zone - 1] }]}>
        {ZONE_LABELS[zone - 1]}
      </Text>
      <Text style={styles.pct}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    fontVariant: ['tabular-nums'],
  },
  pct: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: OrialColors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});