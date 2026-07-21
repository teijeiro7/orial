import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import {
  Moon, HeartPulse, Zap, Dumbbell, Salad, Dna, Coffee, Wallet, Shuffle, type LucideIcon,
} from 'lucide-react-native';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import type { InsightCategory } from '@/src/services/insightService';

interface InsightFilterProps {
  active: InsightCategory | null;
  onSelect: (category: InsightCategory | null) => void;
}

const FILTERS: { category: InsightCategory; label: string; icon: LucideIcon }[] = [
  { category: 'sleep', label: 'Sueño', icon: Moon },
  { category: 'recovery', label: 'Recuperación', icon: HeartPulse },
  { category: 'strain', label: 'Strain', icon: Zap },
  { category: 'gym', label: 'Gimnasio', icon: Dumbbell },
  { category: 'nutrition', label: 'Nutrición', icon: Salad },
  { category: 'healthspan', label: 'Salud', icon: Dna },
  { category: 'caffeine', label: 'Cafeína', icon: Coffee },
  { category: 'finance', label: 'Finanzas', icon: Wallet },
  { category: 'mixed', label: 'Mixto', icon: Shuffle },
];

export function InsightFilter({ active, onSelect }: InsightFilterProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Pressable
        style={[styles.chip, active === null && styles.chipActive]}
        onPress={() => onSelect(null)}
      >
        <Text style={[styles.chipText, active === null && styles.chipTextActive]}>Todos</Text>
      </Pressable>
      {FILTERS.map(({ category, label, icon: Icon }) => (
        <Pressable
          key={category}
          style={[styles.chip, active === category && styles.chipActive]}
          onPress={() => onSelect(active === category ? null : category)}
        >
          <Icon size={14} color={active === category ? OrialColors.deepNavy : OrialColors.textMuted} />
          <Text style={[styles.chipText, active === category && styles.chipTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  chipActive: {
    backgroundColor: OrialColors.violet,
    borderColor: OrialColors.violet,
  },
  chipText: {
    ...OrialTypography.caption,
    color: OrialColors.textMuted,
  },
  chipTextActive: {
    color: OrialColors.deepNavy,
  },
});
