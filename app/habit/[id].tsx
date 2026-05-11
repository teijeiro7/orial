import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Archive, Edit3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { habitRepository } from '../../src/repositories/habitRepository';
import { calculateStreak } from '../../src/utils/streakCalculator';
import { useHabitStore } from '../../src/stores/habitStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { Habit, HabitEntry } from '../../drizzle/schema';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { archiveHabit } = useHabitStore();
  
  const [habit, setHabit] = useState<Habit | null>(null);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const [streak, setStreak] = useState<ReturnType<typeof calculateStreak> | null>(null);

  useEffect(() => {
    loadHabitData();
  }, [id]);

  async function loadHabitData() {
    if (typeof id !== 'string') return;
    
    const habitData = await habitRepository.getHabitById(id);
    if (habitData) {
      setHabit(habitData);
      const habitEntries = await habitRepository.getEntriesForHabit(id);
      setEntries(habitEntries);
      const targetDays = JSON.parse(habitData.targetDays);
      const streakData = calculateStreak(habitEntries, targetDays);
      setStreak(streakData);
    }
  }

  function getLast30Days() {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      days.push(subDays(new Date(), i));
    }
    return days;
  }

  function isDayCompleted(date: Date) {
    return entries.some(entry => 
      entry.completed && isSameDay(new Date(entry.date), date)
    );
  }

  function getCategoryColor(category: string) {
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

  if (!habit) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={OrialTypography.bodyMedium}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const last30Days = getLast30Days();
  const categoryColor = getCategoryColor(habit.category);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={OrialColors.textPrimary} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton}>
              <Edit3 size={20} color={OrialColors.textPrimary} />
            </Pressable>
            <Pressable 
              style={styles.iconButton}
              onPress={() => {
                archiveHabit(habit.id);
                router.back();
              }}
            >
              <Archive size={20} color={OrialColors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.habitHeader}>
          <Text style={styles.habitEmoji}>{habit.emoji}</Text>
          <Text style={OrialTypography.headingLarge}>{habit.name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '30' }]}>
            <Text style={[OrialTypography.caption, { color: categoryColor }]}>
              {habit.category}
            </Text>
          </View>
        </View>

        <GlassCard style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={OrialTypography.headingMedium}>{streak?.currentStreak || 0}</Text>
              <Text style={OrialTypography.caption}>Current Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={OrialTypography.headingMedium}>{streak?.bestStreak || 0}</Text>
              <Text style={OrialTypography.caption}>Best Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={OrialTypography.headingMedium}>{streak?.completionRate || 0}%</Text>
              <Text style={OrialTypography.caption}>30-Day Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={OrialTypography.headingMedium}>{streak?.totalCompleted || 0}</Text>
              <Text style={OrialTypography.caption}>Total Done</Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Last 30 Days</Text>
          <GlassCard>
            <View style={styles.calendarGrid}>
              {last30Days.map((date, index) => {
                const isCompleted = isDayCompleted(date);
                const isToday = isSameDay(date, new Date());
                
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.calendarDay,
                      isCompleted && { backgroundColor: categoryColor },
                      isToday && { borderWidth: 2, borderColor: OrialColors.textPrimary }
                    ]}
                  >
                    <Text style={[
                      OrialTypography.caption,
                      { fontSize: 10 },
                      isCompleted && { color: OrialColors.textPrimary }
                    ]}>
                      {format(date, 'd')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {habit.description && (
          <View style={styles.section}>
            <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Description</Text>
            <GlassCard>
              <Text style={OrialTypography.bodyMedium}>{habit.description}</Text>
            </GlassCard>
          </View>
        )}
      </ScrollView>
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
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
  },
  habitHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  habitEmoji: {
    fontSize: 64,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statsCard: {
    margin: 16,
    marginTop: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: OrialColors.glassBorder,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  calendarDay: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
