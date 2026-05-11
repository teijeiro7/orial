import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Bell, AlertTriangle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { format, getHours } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { HabitGridCard } from '../../src/components/HabitGridCard';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { useHabitStore } from '../../src/stores/habitStore';
import { notificationService } from '../../src/services/notificationService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

export default function HomeScreen() {
  const router = useRouter();
  const { habits, todayEntries, loadHabits, loadTodayEntries, toggleHabitToday, createHabit, isLoading, error, refresh } = useHabitStore();
  const [isCreationVisible, setIsCreationVisible] = useState(false);
  const [showStreakWarning, setShowStreakWarning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHabits();
    loadTodayEntries();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  useEffect(() => {
    // Check for streak at risk (after 21:00 and incomplete habits)
    const checkStreakAtRisk = () => {
      const hour = getHours(new Date());
      const incompleteHabits = habits.filter(h => !isHabitCompleted(h.id));
      
      if (hour >= 21 && incompleteHabits.length > 0) {
        setShowStreakWarning(true);
        
        // Schedule streak at risk notification for 23:30
        incompleteHabits.forEach(habit => {
          notificationService.scheduleStreakAtRiskNotification(
            habit.id,
            habit.name,
            habit.emoji
          );
        });
      } else {
        setShowStreakWarning(false);
      }
    };

    checkStreakAtRisk();
    // Check every minute
    const interval = setInterval(checkStreakAtRisk, 60000);
    return () => clearInterval(interval);
  }, [habits, todayEntries]);

  const isHabitCompleted = (habitId: string) => {
    return todayEntries.some(entry => entry.habitId === habitId && entry.completed);
  };

  const completedCount = habits.filter(h => isHabitCompleted(h.id)).length;
  const totalCount = habits.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={OrialColors.violetLight}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={OrialTypography.caption}>{format(new Date(), 'EEEE, MMM d')}</Text>
            <Text style={OrialTypography.headingMedium}>Good morning</Text>
          </View>
          <Pressable style={styles.iconButton}>
            <Bell size={20} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        {isLoading && (
          <GlassCard style={styles.loadingCard}>
            <Text style={[OrialTypography.bodyMedium, styles.loadingText]}>
              Loading your habits...
            </Text>
          </GlassCard>
        )}

        {error && (
          <GlassCard style={styles.errorCard}>
            <Text style={[OrialTypography.bodyMedium, styles.errorText]}>
              {error}
            </Text>
          </GlassCard>
        )}

        {showStreakWarning && (
          <GlassCard style={styles.warningCard} accentColor={OrialColors.warning}>
            <View style={styles.warningRow}>
              <AlertTriangle size={20} color={OrialColors.warning} />
              <Text style={[OrialTypography.bodyMedium, { color: OrialColors.warning, flex: 1 }]}>
                Some habits are incomplete! Complete them before midnight to keep your streaks.
              </Text>
            </View>
          </GlassCard>
        )}

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
  warningCard: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  loadingCard: {
    margin: 16,
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    textAlign: 'center',
  },
  errorCard: {
    margin: 16,
    alignItems: 'center',
    padding: 24,
    backgroundColor: OrialColors.error + '10',
    borderColor: OrialColors.error + '30',
  },
  errorText: {
    textAlign: 'center',
    color: OrialColors.error,
  },
  habitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 4,
  },
});
