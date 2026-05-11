import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Flame } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { GlassCard } from '../../src/components/GlassCard';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { useHabitStore } from '../../src/stores/habitStore';
import { habitRepository } from '../../src/repositories/habitRepository';
import { calculateStreak } from '../../src/utils/streakCalculator';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { Habit } from '../../drizzle/schema';

const CATEGORIES = [
  { value: 'all', label: 'All', color: OrialColors.textSecondary },
  { value: 'health', label: 'Health', color: OrialColors.categoryHealth },
  { value: 'mind', label: 'Mind', color: OrialColors.categoryMind },
  { value: 'work', label: 'Work', color: OrialColors.categoryWork },
  { value: 'social', label: 'Social', color: OrialColors.categorySocial },
  { value: 'fitness', label: 'Fitness', color: OrialColors.categoryFitness },
  { value: 'learning', label: 'Learning', color: OrialColors.categoryLearn },
];

export default function HabitsScreen() {
  const { habits, loadHabits, createHabit } = useHabitStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreationVisible, setIsCreationVisible] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Map<string, ReturnType<typeof calculateStreak>>>(new Map());

  useEffect(() => {
    loadHabits();
  }, []);

  useEffect(() => {
    async function loadStreaks() {
      const streaks = new Map();
      for (const habit of habits) {
        const entries = await habitRepository.getEntriesForHabit(habit.id);
        const targetDays = JSON.parse(habit.targetDays);
        const streak = calculateStreak(entries, targetDays);
        streaks.set(habit.id, streak);
      }
      setHabitStreaks(streaks);
    }
    loadStreaks();
  }, [habits]);

  const filteredHabits = selectedCategory === 'all' 
    ? habits 
    : habits.filter(h => h.category === selectedCategory);

  const totalStreaks = Array.from(habitStreaks.values()).reduce((sum, s) => sum + s.currentStreak, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>My Habits</Text>
          <Pressable 
            style={styles.addButton}
            onPress={() => setIsCreationVisible(true)}
          >
            <Plus size={20} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <GlassCard style={styles.streakCard}>
          <View style={styles.streakRow}>
            <Flame size={24} color={OrialColors.warning} />
            <Text style={OrialTypography.headingMedium}>
              {totalStreaks} day streaks
            </Text>
          </View>
        </GlassCard>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContainer}
        >
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.value}
              onPress={() => setSelectedCategory(cat.value)}
              style={[
                styles.categoryChip,
                selectedCategory === cat.value && { 
                  backgroundColor: cat.color + '30',
                  borderColor: cat.color 
                }
              ]}
            >
              <Text style={[
                OrialTypography.caption,
                { color: selectedCategory === cat.value ? cat.color : OrialColors.textSecondary }
              ]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {filteredHabits.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
              {habits.length === 0
                ? "No habits yet. Create your first habit!"
                : "No habits in this category."}
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.habitsList}>
            {filteredHabits.map(habit => {
            const streak = habitStreaks.get(habit.id);
            return (
              <GlassCard key={habit.id} style={styles.habitItem}>
                <View style={styles.habitRow}>
                  <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                  <View style={styles.habitInfo}>
                    <Text style={OrialTypography.bodyMedium}>{habit.name}</Text>
                    <View style={styles.habitMeta}>
                      <Text style={OrialTypography.caption}>
                        Streak: {streak?.currentStreak || 0} | Best: {streak?.bestStreak || 0} | {streak?.completionRate || 0}%
                      </Text>
                    </View>
                  </View>
                  <View 
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: getCategoryColor(habit.category) + '30' }
                    ]}
                  >
                    <Text style={[
                      OrialTypography.caption,
                      { color: getCategoryColor(habit.category) }
                    ]}>
                      {habit.category}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            );
          })}
          </View>
        )}
      </ScrollView>

      <HabitCreationSheet
        visible={isCreationVisible}
        onClose={() => setIsCreationVisible(false)}
        onSave={(habitData) => {
          createHabit({
            ...habitData,
            isArchived: false,
            isAiSuggested: false,
          } as any);
        }}
      />
    </SafeAreaView>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'health': return OrialColors.categoryHealth;
    case 'mind': return OrialColors.categoryMind;
    case 'work': return OrialColors.categoryWork;
    case 'social': return OrialColors.categorySocial;
    case 'fitness': return OrialColors.categoryFitness;
    case 'learning': return OrialColors.categoryLearn;
    default: return OrialColors.categoryOther;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  addButton: {
    padding: 8,
    backgroundColor: OrialColors.violet,
    borderRadius: 12,
  },
  streakCard: {
    margin: 16,
    marginTop: 0,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoriesScroll: {
    maxHeight: 50,
    marginBottom: 16,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  habitsList: {
    padding: 16,
    gap: 12,
  },
  habitItem: {
    padding: 16,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitEmoji: {
    fontSize: 28,
  },
  habitInfo: {
    flex: 1,
  },
  habitMeta: {
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
});
