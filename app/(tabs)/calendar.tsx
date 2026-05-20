import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Flame, Check } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDate } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { calendarService } from '../../src/services/calendarService';
import { useHabitStore } from '../../src/stores/habitStore';
import { habitRepository } from '../../src/repositories/habitRepository';
import { calculateStreak } from '../../src/utils/streakCalculator';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { agentService } from '../../src/services/openclawService';
import type { Habit } from '../../drizzle/schema';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_SIZE = (SCREEN_WIDTH - 64) / 7;

const CATEGORIES = [
  { value: 'all', label: 'All', color: OrialColors.textSecondary },
  { value: 'health', label: 'Health', color: OrialColors.categoryHealth },
  { value: 'mind', label: 'Mind', color: OrialColors.categoryMind },
  { value: 'work', label: 'Work', color: OrialColors.categoryWork },
  { value: 'social', label: 'Social', color: OrialColors.categorySocial },
  { value: 'fitness', label: 'Fitness', color: OrialColors.categoryFitness },
  { value: 'learning', label: 'Learning', color: OrialColors.categoryLearn },
];

type Tab = 'calendar' | 'habits';

export default function DailyScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const { habits, todayEntries, loadHabits, createHabit, toggleHabit } = useHabitStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreationVisible, setIsCreationVisible] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Map<string, ReturnType<typeof calculateStreak>>>(new Map());

  useEffect(() => {
    loadHabits();
    loadEvents();
  }, [currentMonth]);

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
    if (activeTab === 'habits') loadStreaks();
  }, [habits, activeTab]);

  async function loadEvents() {
    const monthEvents = await calendarService.getEventsForMonth(
      currentMonth.getFullYear(),
      currentMonth.getMonth()
    );
    setEvents(monthEvents);
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDateEvents = events.filter(event =>
    isSameDay(new Date(event.startDate), selectedDate)
  );

  const selectedDateHabits = habits.filter(habit => {
    const targetDays = JSON.parse(habit.targetDays || '[]');
    const dayOfWeek = selectedDate.getDay() || 7;
    return targetDays.includes(dayOfWeek);
  });

  const isHabitCompleted = (habitId: string) => {
    return todayEntries.some(entry =>
      entry.habitId === habitId &&
      entry.completed &&
      isSameDay(new Date(entry.date), selectedDate)
    );
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(new Date(event.startDate), day));
  };

  const hasEvents = (day: Date) => getEventsForDay(day).length > 0;

  const filteredHabits = selectedCategory === 'all'
    ? habits
    : habits.filter(h => h.category === selectedCategory);

  const totalStreaks = Array.from(habitStreaks.values()).reduce((sum, s) => sum + s.currentStreak, 0);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
          onPress={() => setActiveTab('calendar')}
        >
          <Text style={[styles.tabText, activeTab === 'calendar' && styles.tabTextActive]}>
            Calendar
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'habits' && styles.tabActive]}
          onPress={() => setActiveTab('habits')}
        >
          <Text style={[styles.tabText, activeTab === 'habits' && styles.tabTextActive]}>
            Habits
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'calendar' ? (
          <>
            {/* Calendar Grid */}
            <GlassCard style={styles.calendarCard}>
              <View style={styles.monthHeader}>
                <Pressable onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft size={24} color={OrialColors.textPrimary} />
                </Pressable>
                <Text style={OrialTypography.headingSmall}>
                  {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight size={24} color={OrialColors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.weekDaysHeader}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <View key={day} style={styles.weekDayCell}>
                    <Text style={[OrialTypography.caption, styles.weekDayText]}>{day}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const dayHasEvents = hasEvents(day);

                  return (
                    <Pressable
                      key={index}
                      style={[
                        styles.dayCell,
                        { width: DAY_SIZE, height: DAY_SIZE },
                        isSelected && styles.selectedDay,
                        isToday && styles.todayDay,
                      ]}
                      onPress={() => setSelectedDate(day)}
                    >
                      <Text
                        style={[
                          OrialTypography.bodyMedium,
                          styles.dayText,
                          !isCurrentMonth && styles.otherMonthDay,
                          isSelected && styles.selectedDayText,
                          isToday && styles.todayDayText,
                        ]}
                      >
                        {getDate(day)}
                      </Text>
                      {dayHasEvents && <View style={styles.eventDot} />}
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            {/* Selected Date Details */}
            <View style={styles.section}>
              <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>
                {format(selectedDate, 'EEEE, MMM d')}
              </Text>

              {/* Habits for selected date */}
              {selectedDateHabits.length > 0 && (
                <View style={styles.habitsSection}>
                  <Text style={[OrialTypography.caption, styles.subSectionTitle]}>Habits</Text>
                  {selectedDateHabits.map(habit => (
                    <Pressable
                      key={habit.id}
                      onPress={() => toggleHabit(habit.id, selectedDate.toISOString().split('T')[0])}
                    >
                      <GlassCard style={styles.habitItem}>
                        <View style={styles.habitRow}>
                          <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                          <Text style={OrialTypography.bodyMedium}>{habit.name}</Text>
                          <View style={[
                            styles.checkIndicator,
                            isHabitCompleted(habit.id) && { backgroundColor: OrialColors.success }
                          ]}>
                            {isHabitCompleted(habit.id) && (
                              <Check size={14} color={OrialColors.textPrimary} />
                            )}
                          </View>
                        </View>
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Events for selected date */}
              {selectedDateEvents.length > 0 ? (
                <View style={styles.eventsSection}>
                  <Text style={[OrialTypography.caption, styles.subSectionTitle]}>Events</Text>
                  {selectedDateEvents.map((event, index) => (
                    <GlassCard key={index} style={styles.eventItem}>
                      <View style={styles.eventRow}>
                        <View style={styles.eventTime}>
                          <Text style={OrialTypography.caption}>
                            {format(new Date(event.startDate), 'HH:mm')}
                          </Text>
                        </View>
                        <View style={styles.eventInfo}>
                          <Text style={OrialTypography.bodyMedium}>{event.title}</Text>
                          {event.notes && (
                            <Text style={OrialTypography.caption}>{event.notes}</Text>
                          )}
                        </View>
                      </View>
                    </GlassCard>
                  ))}
                </View>
              ) : (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                    No events for this day
                  </Text>
                </GlassCard>
              )}
            </View>
          </>
        ) : (
          /* ---- Habits Tab ---- */
          <>
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
                      borderColor: cat.color,
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
          </>
        )}
      </ScrollView>

      <HabitCreationSheet
        visible={isCreationVisible}
        onClose={() => setIsCreationVisible(false)}
        onSave={(habitData: any) => {
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
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: OrialColors.violet,
  },
  tabText: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textMuted,
  },
  tabTextActive: {
    color: OrialColors.textPrimary,
    fontWeight: '600',
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
  calendarCard: {
    margin: 16,
    marginTop: 12,
    padding: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    width: DAY_SIZE,
    alignItems: 'center',
  },
  weekDayText: {
    color: OrialColors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  dayText: {
    color: OrialColors.textPrimary,
  },
  otherMonthDay: {
    color: OrialColors.textMuted,
    opacity: 0.5,
  },
  selectedDay: {
    backgroundColor: OrialColors.violet,
  },
  selectedDayText: {
    color: OrialColors.textPrimary,
    fontWeight: 'bold',
  },
  todayDay: {
    borderWidth: 2,
    borderColor: OrialColors.violetLight,
  },
  todayDayText: {
    color: OrialColors.violetLight,
    fontWeight: 'bold',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: OrialColors.warning,
    marginTop: 2,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  subSectionTitle: {
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  habitsSection: {
    marginBottom: 16,
  },
  habitItem: {
    marginBottom: 8,
    padding: 12,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitEmoji: {
    fontSize: 24,
  },
  checkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  eventsSection: {
    gap: 8,
  },
  eventItem: {
    padding: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventTime: {
    minWidth: 50,
  },
  eventInfo: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
    marginTop: 0,
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
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
});
