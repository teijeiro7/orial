import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Bell } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { HabitGridCard } from '../../src/components/HabitGridCard';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { useHabitStore } from '../../src/stores/habitStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

export default function HomeScreen() {
  const router = useRouter();
  const { habits, todayEntries, loadHabits, loadTodayEntries, toggleHabitToday, createHabit } = useHabitStore();
  const [isCreationVisible, setIsCreationVisible] = useState(false);

  useEffect(() => {
    loadHabits();
    loadTodayEntries();
  }, []);

  const isHabitCompleted = (habitId: string) => {
    return todayEntries.some(entry => entry.habitId === habitId && entry.completed);
  };

  const completedCount = habits.filter(h => isHabitCompleted(h.id)).length;
  const totalCount = habits.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={OrialTypography.caption}>{format(new Date(), 'EEEE, MMM d')}</Text>
            <Text style={OrialTypography.headingMedium}>Good morning</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Bell size={20} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <GlassCard style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={OrialTypography.bodyMedium}>
              {completedCount} of {totalCount} habits done
            </Text>
            <Text style={[OrialTypography.headingMedium, { color: OrialColors.violetLight }]}>
              {progressPercentage}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progressPercentage}%` }
              ]} 
            />
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={OrialTypography.headingSmall}>Today's Habits</Text>
          <Pressable 
            style={styles.addButton}
            onPress={() => setIsCreationVisible(true)}
          >
            <Plus size={16} color={OrialColors.textPrimary} />
            <Text style={[OrialTypography.caption, styles.addButtonText]}>Add</Text>
          </Pressable>
        </View>

        {habits.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
              No habits yet. Tap "Add" to create your first habit!
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.habitGrid}>
            {habits.map(habit => (
              <HabitGridCard
                key={habit.id}
                habit={habit}
                isCompleted={isHabitCompleted(habit.id)}
                onToggle={() => toggleHabitToday(habit.id)}
                onLongPress={() => router.push(`/habit/${habit.id}`)}
              />
            ))}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  iconButton: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
  },
  progressCard: {
    margin: 16,
    marginTop: 0,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: OrialColors.violet,
    borderRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addButtonText: {
    color: OrialColors.textPrimary,
  },
  emptyCard: {
    margin: 16,
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
  habitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 4,
  },
});
