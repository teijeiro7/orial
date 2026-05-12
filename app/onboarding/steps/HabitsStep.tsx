import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Target, SkipForward, Check } from 'lucide-react-native';
import { useState } from 'react';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface HabitsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

const HABIT_TEMPLATES = [
  { name: 'Morning Exercise', icon: '🏃', category: 'health' as const },
  { name: 'Read 30 minutes', icon: '📚', category: 'mind' as const },
  { name: 'Drink 8 glasses of water', icon: '💧', category: 'health' as const },
  { name: 'Meditate', icon: '🧘', category: 'mind' as const },
  { name: 'Journal', icon: '✍️', category: 'mind' as const },
  { name: 'Sleep by 11pm', icon: '😴', category: 'health' as const },
];

export function HabitsStep({ onNext, onSkip }: HabitsStepProps) {
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);

  function toggleHabit(name: string) {
    setSelectedHabits(prev =>
      prev.includes(name) ? prev.filter(h => h !== name) : [...prev, name]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Target size={32} color={OrialColors.violet} />
        </View>
        
        <Text style={OrialTypography.headingMedium}>Create Your Habits</Text>
        <Text style={[OrialTypography.bodyMedium, styles.description]}>
          Start with a few habits you want to build. You can always add more later.
        </Text>
      </View>

      <GlassCard style={styles.templatesCard}>
        <Text style={[OrialTypography.caption, styles.sectionTitle]}>SUGGESTED HABITS</Text>
        <View style={styles.habitGrid}>
          {HABIT_TEMPLATES.map((habit) => (
            <Pressable
              key={habit.name}
              style={[
                styles.habitItem,
                selectedHabits.includes(habit.name) && styles.habitItemSelected,
              ]}
              onPress={() => toggleHabit(habit.name)}
            >
              <Text style={styles.habitIcon}>{habit.icon}</Text>
              <Text style={OrialTypography.bodySmall} numberOfLines={1}>
                {habit.name}
              </Text>
              {selectedHabits.includes(habit.name) && (
                <View style={styles.checkBadge}>
                  <Check size={12} color={OrialColors.textPrimary} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {selectedHabits.length > 0 && (
        <GlassCard style={styles.selectedCard}>
          <Text style={OrialTypography.caption}>
            {selectedHabits.length} habit{selectedHabits.length > 1 ? 's' : ''} selected
          </Text>
        </GlassCard>
      )}

      <View style={styles.actions}>
        <Pressable 
          style={styles.primaryButton} 
          onPress={onNext}
          disabled={selectedHabits.length === 0}
        >
          <Text style={[OrialTypography.button, styles.primaryButtonText]}>
            Create {selectedHabits.length > 0 ? `${selectedHabits.length} ` : ''}Habits
          </Text>
          <ArrowRight size={20} color={OrialColors.textPrimary} />
        </Pressable>
        
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <SkipForward size={16} color={OrialColors.textMuted} />
          <Text style={[OrialTypography.caption, styles.skipText]}>I'll do this later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: OrialColors.violet + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    marginTop: 8,
  },
  templatesCard: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  habitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  habitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    minWidth: '45%',
  },
  habitItemSelected: {
    borderColor: OrialColors.violet,
    backgroundColor: OrialColors.violet + '10',
  },
  habitIcon: {
    fontSize: 16,
  },
  checkBadge: {
    marginLeft: 'auto',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCard: {
    padding: 12,
    alignItems: 'center',
    backgroundColor: OrialColors.violet + '10',
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: OrialColors.textPrimary,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  skipText: {
    color: OrialColors.textMuted,
  },
});