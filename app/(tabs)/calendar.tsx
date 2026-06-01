import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  Check,
  Clock,
  ArrowRight,
  Trash2,
  Star,
} from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDate,
} from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { calendarService } from '../../src/services/calendarService';
import { taskService } from '../../src/services/taskService';
import { useHabitStore } from '../../src/stores/habitStore';
import { habitRepository } from '../../src/repositories/habitRepository';
import { calculateStreak } from '../../src/utils/streakCalculator';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { Habit, Task } from '../../drizzle/schema';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_SIZE = (SCREEN_WIDTH - 64) / 7;

const HOURS = Array.from({ length: 17 }, (_, i) => i + 8); // 8..24

const CATEGORIES = [
  { value: 'all', label: 'All', color: OrialColors.textSecondary },
  { value: 'health', label: 'Health', color: OrialColors.categoryHealth },
  { value: 'mind', label: 'Mind', color: OrialColors.categoryMind },
  { value: 'work', label: 'Work', color: OrialColors.categoryWork },
  { value: 'social', label: 'Social', color: OrialColors.categorySocial },
  { value: 'fitness', label: 'Fitness', color: OrialColors.categoryFitness },
  { value: 'learning', label: 'Learning', color: OrialColors.categoryLearn },
];

type Tab = 'calendar' | 'habits' | 'tasks';

export default function DailyScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const { habits, todayEntries, loadHabits, createHabit, toggleHabit } = useHabitStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreationVisible, setIsCreationVisible] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Map<string, ReturnType<typeof calculateStreak>>>(new Map());

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStreak, setTaskStreak] = useState(0);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHour, setNewTaskHour] = useState<number | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState(0);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);

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

  const loadTasks = useCallback(async () => {
    const [dayTasks, streak] = await Promise.all([
      taskService.getTasksForDate(taskDate),
      taskService.getDailyStreak(),
    ]);
    setTasks(dayTasks);
    setTaskStreak(streak);
  }, [taskDate]);

  useEffect(() => {
    if (activeTab === 'tasks') loadTasks();
  }, [activeTab, taskDate, loadTasks]);

  async function loadEvents() {
    const monthEvents = await calendarService.getEventsForMonth(
      currentMonth.getFullYear(),
      currentMonth.getMonth()
    );
    setEvents(monthEvents);
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    await taskService.createTask({
      title: newTaskTitle.trim(),
      date: taskDate,
      scheduledHour: newTaskHour ?? undefined,
      priority: newTaskPriority,
    });
    setNewTaskTitle('');
    setNewTaskHour(null);
    setNewTaskPriority(0);
    setShowAddTask(false);
    loadTasks();
  }

  async function handleToggleTask(id: string) {
    await taskService.toggleTask(id);
    loadTasks();
  }

  async function handleDeleteTask(id: string) {
    await taskService.deleteTask(id);
    loadTasks();
  }

  async function handlePushToTomorrow() {
    const count = await taskService.pushRemainingToTomorrow(taskDate);
    if (count === 0) {
      Alert.alert('Nothing to push', 'All tasks are completed.');
    } else {
      Alert.alert('Pushed', `${count} task${count === 1 ? '' : 's'} moved to tomorrow.`);
      loadTasks();
    }
  }

  // Group tasks by hour for the schedule panel
  const scheduledTasks = tasks.filter((t) => t.scheduledHour !== null && t.scheduledHour !== undefined);
  const unscheduledTasks = tasks.filter((t) => t.scheduledHour === null || t.scheduledHour === undefined);
  const completedCount = tasks.filter((t) => t.completed).length;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDateEvents = events.filter((event) =>
    isSameDay(new Date(event.startDate), selectedDate)
  );

  const selectedDateHabits = habits.filter((habit) => {
    const targetDays = JSON.parse(habit.targetDays || '[]');
    const dayOfWeek = selectedDate.getDay() || 7;
    return targetDays.includes(dayOfWeek);
  });

  const isHabitCompleted = (habitId: string) =>
    todayEntries.some(
      (entry) =>
        entry.habitId === habitId &&
        entry.completed &&
        isSameDay(new Date(entry.date), selectedDate)
    );

  const getEventsForDay = (day: Date) =>
    events.filter((event) => isSameDay(new Date(event.startDate), day));
  const hasEvents = (day: Date) => getEventsForDay(day).length > 0;

  const filteredHabits =
    selectedCategory === 'all' ? habits : habits.filter((h) => h.category === selectedCategory);

  const totalStreaks = Array.from(habitStreaks.values()).reduce(
    (sum, s) => sum + s.currentStreak,
    0
  );

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

  function formatHour(h: number) {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>Tasks</Text>
        </Pressable>
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
          <Text style={[styles.tabText, activeTab === 'habits' && styles.tabTextActive]}>Habits</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── TASKS TAB ────────────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <>
            {/* Header row */}
            <View style={styles.header}>
              <View>
                <Text style={OrialTypography.headingMedium}>
                  {taskDate === new Date().toISOString().split('T')[0]
                    ? 'Today'
                    : format(new Date(taskDate + 'T12:00:00'), 'EEE, MMM d')}
                </Text>
                <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                  {completedCount}/{tasks.length} done
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={handlePushToTomorrow}
                >
                  <ArrowRight size={18} color={OrialColors.warning} />
                </Pressable>
                <Pressable style={styles.addButton} onPress={() => setShowAddTask(true)}>
                  <Plus size={20} color={OrialColors.textPrimary} />
                </Pressable>
              </View>
            </View>

            {/* Streak + date nav */}
            <GlassCard style={styles.streakCard}>
              <View style={styles.streakRow}>
                <Flame size={20} color={OrialColors.warning} />
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.warning }]}>
                  {taskStreak} day streak
                </Text>
                <View style={styles.dateNav}>
                  <Pressable
                    onPress={() => {
                      const d = new Date(taskDate + 'T12:00:00');
                      d.setDate(d.getDate() - 1);
                      setTaskDate(d.toISOString().split('T')[0]);
                    }}
                  >
                    <ChevronLeft size={20} color={OrialColors.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => setTaskDate(new Date().toISOString().split('T')[0])}>
                    <Text style={[OrialTypography.caption, { color: OrialColors.violetLight }]}>
                      Today
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const d = new Date(taskDate + 'T12:00:00');
                      d.setDate(d.getDate() + 1);
                      setTaskDate(d.toISOString().split('T')[0]);
                    }}
                  >
                    <ChevronRight size={20} color={OrialColors.textMuted} />
                  </Pressable>
                </View>
              </View>
            </GlassCard>

            {/* Hourly schedule panel */}
            {scheduledTasks.length > 0 && (
              <GlassCard style={styles.scheduleCard}>
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>SCHEDULE</Text>
                {HOURS.map((h) => {
                  const hourTasks = scheduledTasks.filter((t) => t.scheduledHour === h);
                  return (
                    <View key={h} style={styles.hourRow}>
                      <Text style={styles.hourLabel}>{formatHour(h)}</Text>
                      <View style={styles.hourLine} />
                      <View style={styles.hourTasks}>
                        {hourTasks.map((t) => (
                          <Pressable
                            key={t.id}
                            style={[
                              styles.hourTask,
                              t.completed && styles.hourTaskDone,
                              t.priority === 1 && styles.hourTaskHighPriority,
                            ]}
                            onPress={() => handleToggleTask(t.id)}
                          >
                            <Text
                              style={[
                                styles.hourTaskText,
                                t.completed && styles.taskDoneText,
                              ]}
                              numberOfLines={1}
                            >
                              {t.title}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </GlassCard>
            )}

            {/* Unscheduled To-Do list */}
            <View style={styles.section}>
              {unscheduledTasks.length > 0 && (
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>TO-DO</Text>
              )}
              {tasks.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                    No tasks. Tap + to add one.
                  </Text>
                </GlassCard>
              ) : (
                unscheduledTasks.map((t) => (
                  <GlassCard key={t.id} style={[styles.taskCard, t.completed && styles.taskCardDone]}>
                    <View style={styles.taskRow}>
                      <Pressable
                        style={[styles.taskCheck, t.completed && styles.taskCheckDone]}
                        onPress={() => handleToggleTask(t.id)}
                      >
                        {t.completed && <Check size={14} color="#fff" />}
                      </Pressable>
                      <View style={styles.taskBody}>
                        <Text
                          style={[
                            OrialTypography.bodyMedium,
                            t.completed && styles.taskDoneText,
                          ]}
                          numberOfLines={2}
                        >
                          {t.priority === 1 && (
                            <Star
                              size={12}
                              color={OrialColors.warning}
                              fill={OrialColors.warning}
                            />
                          )}{' '}
                          {t.title}
                        </Text>
                        {t.pushedFrom && (
                          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                            Pushed from {t.pushedFrom}
                          </Text>
                        )}
                      </View>
                      <Pressable onPress={() => handleDeleteTask(t.id)} style={styles.deleteBtn}>
                        <Trash2 size={16} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  </GlassCard>
                ))
              )}
            </View>
          </>
        )}

        {/* ── CALENDAR TAB ─────────────────────────────────────── */}
        {activeTab === 'calendar' && (
          <>
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
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
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

            <View style={styles.section}>
              <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>
                {format(selectedDate, 'EEEE, MMM d')}
              </Text>

              {selectedDateHabits.length > 0 && (
                <View style={styles.habitsSection}>
                  <Text style={[OrialTypography.caption, styles.subSectionTitle]}>Habits</Text>
                  {selectedDateHabits.map((habit) => (
                    <Pressable
                      key={habit.id}
                      onPress={() => toggleHabit(habit.id, selectedDate.toISOString().split('T')[0])}
                    >
                      <GlassCard style={styles.habitItem}>
                        <View style={styles.habitRow}>
                          <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                          <Text style={OrialTypography.bodyMedium}>{habit.name}</Text>
                          <View
                            style={[
                              styles.checkIndicator,
                              isHabitCompleted(habit.id) && { backgroundColor: OrialColors.success },
                            ]}
                          >
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
        )}

        {/* ── HABITS TAB ───────────────────────────────────────── */}
        {activeTab === 'habits' && (
          <>
            <View style={styles.header}>
              <Text style={OrialTypography.headingMedium}>My Habits</Text>
              <Pressable style={styles.addButton} onPress={() => setIsCreationVisible(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>

            <GlassCard style={styles.streakCard}>
              <View style={styles.streakRow}>
                <Flame size={24} color={OrialColors.warning} />
                <Text style={OrialTypography.headingMedium}>{totalStreaks} day streaks</Text>
              </View>
            </GlassCard>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categoriesContainer}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.value}
                  onPress={() => setSelectedCategory(cat.value)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.value && {
                      backgroundColor: cat.color + '30',
                      borderColor: cat.color,
                    },
                  ]}
                >
                  <Text
                    style={[
                      OrialTypography.caption,
                      {
                        color:
                          selectedCategory === cat.value ? cat.color : OrialColors.textSecondary,
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredHabits.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                  {habits.length === 0
                    ? 'No habits yet. Create your first habit!'
                    : 'No habits in this category.'}
                </Text>
              </GlassCard>
            ) : (
              <View style={styles.habitsList}>
                {filteredHabits.map((habit) => {
                  const streak = habitStreaks.get(habit.id);
                  return (
                    <GlassCard key={habit.id} style={styles.habitItem}>
                      <View style={styles.habitRow}>
                        <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                        <View style={styles.habitInfo}>
                          <Text style={OrialTypography.bodyMedium}>{habit.name}</Text>
                          <View style={styles.habitMeta}>
                            <Text style={OrialTypography.caption}>
                              Streak: {streak?.currentStreak || 0} | Best:{' '}
                              {streak?.bestStreak || 0} | {streak?.completionRate || 0}%
                            </Text>
                          </View>
                        </View>
                        <View
                          style={[
                            styles.categoryBadge,
                            { backgroundColor: getCategoryColor(habit.category) + '30' },
                          ]}
                        >
                          <Text
                            style={[
                              OrialTypography.caption,
                              { color: getCategoryColor(habit.category) },
                            ]}
                          >
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

      {/* ── Add Task Modal ───────────────────────────────────────── */}
      <Modal visible={showAddTask} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Task</Text>

            <TextInput
              style={styles.input}
              placeholder="Task title..."
              placeholderTextColor={OrialColors.textMuted}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            {/* Priority toggle */}
            <View style={styles.modalRow}>
              <Text style={OrialTypography.bodyMedium}>Priority</Text>
              <Pressable
                style={[styles.priorityBtn, newTaskPriority === 1 && styles.priorityBtnActive]}
                onPress={() => setNewTaskPriority(newTaskPriority === 1 ? 0 : 1)}
              >
                <Star
                  size={16}
                  color={newTaskPriority === 1 ? OrialColors.warning : OrialColors.textMuted}
                  fill={newTaskPriority === 1 ? OrialColors.warning : 'transparent'}
                />
                <Text
                  style={[
                    OrialTypography.caption,
                    { color: newTaskPriority === 1 ? OrialColors.warning : OrialColors.textMuted },
                  ]}
                >
                  High
                </Text>
              </Pressable>
            </View>

            {/* Hour picker */}
            <View style={styles.modalRow}>
              <Text style={OrialTypography.bodyMedium}>Schedule</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable
                  style={[styles.hourChip, newTaskHour === null && styles.hourChipActive]}
                  onPress={() => setNewTaskHour(null)}
                >
                  <Text
                    style={[
                      OrialTypography.caption,
                      { color: newTaskHour === null ? OrialColors.textPrimary : OrialColors.textMuted },
                    ]}
                  >
                    None
                  </Text>
                </Pressable>
                {HOURS.map((h) => (
                  <Pressable
                    key={h}
                    style={[styles.hourChip, newTaskHour === h && styles.hourChipActive]}
                    onPress={() => setNewTaskHour(h)}
                  >
                    <Text
                      style={[
                        OrialTypography.caption,
                        { color: newTaskHour === h ? OrialColors.textPrimary : OrialColors.textMuted },
                      ]}
                    >
                      {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddTask(false);
                  setNewTaskTitle('');
                  setNewTaskHour(null);
                  setNewTaskPriority(0);
                }}
              >
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddTask}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: OrialColors.violet },
  tabText: { ...OrialTypography.bodyMedium, color: OrialColors.textMuted },
  tabTextActive: { color: OrialColors.textPrimary, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  addButton: { padding: 8, backgroundColor: OrialColors.violet, borderRadius: 12 },
  streakCard: { marginHorizontal: 16, marginBottom: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  scheduleCard: { marginHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    color: OrialColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, minHeight: 28 },
  hourLabel: {
    ...OrialTypography.caption,
    color: OrialColors.textMuted,
    width: 50,
    paddingTop: 4,
  },
  hourLine: {
    width: 1,
    backgroundColor: OrialColors.glassBorder,
    marginHorizontal: 8,
    alignSelf: 'stretch',
  },
  hourTasks: { flex: 1, gap: 4 },
  hourTask: {
    backgroundColor: OrialColors.violet + '40',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderLeftWidth: 2,
    borderLeftColor: OrialColors.violet,
  },
  hourTaskDone: { opacity: 0.5 },
  hourTaskHighPriority: { borderLeftColor: OrialColors.warning },
  hourTaskText: { ...OrialTypography.caption, color: OrialColors.textPrimary },
  section: { padding: 16, paddingTop: 0 },
  taskCard: { marginBottom: 8, padding: 12 },
  taskCardDone: { opacity: 0.6 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: OrialColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCheckDone: { backgroundColor: OrialColors.success, borderColor: OrialColors.success },
  taskBody: { flex: 1 },
  taskDoneText: { textDecorationLine: 'line-through', color: OrialColors.textMuted },
  deleteBtn: { padding: 4 },
  // Calendar styles
  calendarCard: { margin: 16, marginTop: 12, padding: 16 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  weekDaysHeader: { flexDirection: 'row', marginBottom: 8 },
  weekDayCell: { width: DAY_SIZE, alignItems: 'center' },
  weekDayText: { color: OrialColors.textMuted },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginBottom: 4 },
  dayText: { color: OrialColors.textPrimary },
  otherMonthDay: { color: OrialColors.textMuted, opacity: 0.5 },
  selectedDay: { backgroundColor: OrialColors.violet },
  selectedDayText: { color: OrialColors.textPrimary, fontWeight: 'bold' },
  todayDay: { borderWidth: 2, borderColor: OrialColors.violetLight },
  todayDayText: { color: OrialColors.violetLight, fontWeight: 'bold' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: OrialColors.warning, marginTop: 2 },
  sectionTitle: { marginBottom: 12 },
  subSectionTitle: { marginBottom: 8, textTransform: 'uppercase', color: OrialColors.textMuted },
  habitsSection: { marginBottom: 16 },
  habitItem: { marginBottom: 8, padding: 12 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitEmoji: { fontSize: 24 },
  checkIndicator: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center', alignItems: 'center', marginLeft: 'auto',
  },
  eventsSection: { gap: 8 },
  eventItem: { padding: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eventTime: { minWidth: 50 },
  eventInfo: { flex: 1 },
  emptyCard: { margin: 16, marginTop: 0, alignItems: 'center', padding: 24 },
  emptyText: { textAlign: 'center', color: OrialColors.textMuted },
  categoriesScroll: { maxHeight: 50, marginBottom: 16 },
  categoriesContainer: { paddingHorizontal: 16, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: OrialColors.surface, borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  habitsList: { padding: 16, gap: 12 },
  habitInfo: { flex: 1 },
  habitMeta: { marginTop: 4 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { margin: 16, padding: 20 },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    padding: 12,
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  priorityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: OrialColors.surface, borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  priorityBtnActive: { borderColor: OrialColors.warning, backgroundColor: OrialColors.warning + '20' },
  hourChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: OrialColors.surface, borderWidth: 1, borderColor: OrialColors.glassBorder,
    marginRight: 6,
  },
  hourChipActive: { backgroundColor: OrialColors.violet, borderColor: OrialColors.violet },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: OrialColors.violet, borderRadius: 10,
  },
});
