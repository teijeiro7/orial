import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  Check,
  ArrowRight,
  Trash2,
  Star,
  X,
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
import { es } from 'date-fns/locale';
import { HabitCreationSheet } from '../../src/components/HabitCreationSheet';
import { calendarService } from '../../src/services/calendarService';
import { taskService } from '../../src/services/taskService';
import { useHabitStore } from '../../src/stores/habitStore';
import { habitRepository } from '../../src/repositories/habitRepository';
import { calculateStreak } from '../../src/utils/streakCalculator';
import { OrialColors } from '../../src/utils/colors';
import type { Task } from '../../drizzle/schema';

const CAL_PAD = 16;

const SCHEDULE_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

const CATEGORIES = [
  { value: 'all', label: 'Todos', color: OrialColors.textSecondary },
  { value: 'health', label: 'Salud', color: OrialColors.categoryHealth },
  { value: 'mind', label: 'Mente', color: OrialColors.categoryMind },
  { value: 'work', label: 'Trabajo', color: OrialColors.categoryWork },
  { value: 'social', label: 'Social', color: OrialColors.categorySocial },
  { value: 'fitness', label: 'Fitness', color: OrialColors.categoryFitness },
  { value: 'learning', label: 'Aprender', color: OrialColors.categoryLearn },
];

type Tab = 'tasks' | 'calendar' | 'habits';

function formatHour(h: number) {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    health: OrialColors.categoryHealth,
    mind: OrialColors.categoryMind,
    work: OrialColors.categoryWork,
    social: OrialColors.categorySocial,
    fitness: OrialColors.categoryFitness,
    learning: OrialColors.categoryLearn,
  };
  return map[category] ?? OrialColors.categoryOther;
}

export default function DailyScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  const { habits, todayEntries, loadHabits, createHabit, toggleHabit } = useHabitStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreationVisible, setIsCreationVisible] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Map<string, ReturnType<typeof calculateStreak>>>(new Map());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskStreak, setTaskStreak] = useState(0);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHour, setNewTaskHour] = useState<number | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState(0);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { loadHabits(); loadEvents(); }, [currentMonth]);

  useEffect(() => {
    async function loadStreaks() {
      const map = new Map();
      for (const h of habits) {
        const entries = await habitRepository.getEntriesForHabit(h.id);
        const targetDays = JSON.parse(h.targetDays);
        map.set(h.id, calculateStreak(entries, targetDays));
      }
      setHabitStreaks(map);
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
    await taskService.pushRemainingToTomorrow(taskDate);
    loadTasks();
  }

  // Derived values
  const scheduledTasks = tasks.filter(t => t.scheduledHour != null);
  const unscheduledTasks = tasks.filter(t => t.scheduledHour == null);
  const completedCount = tasks.filter(t => t.completed).length;
  const progressRatio = tasks.length > 0 ? completedCount / tasks.length : 0;
  const occupiedHours = SCHEDULE_HOURS.filter(h => scheduledTasks.some(t => t.scheduledHour === h));

  const todayStr = new Date().toISOString().split('T')[0];
  const taskDateLabel = taskDate === todayStr
    ? format(new Date(), "EEEE, d MMM", { locale: es })
    : format(new Date(taskDate + 'T12:00:00'), "EEEE, d MMM", { locale: es });

  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  const selectedDateEvents = events.filter(e => isSameDay(new Date(e.startDate), selectedDate));
  const selectedDateHabits = habits.filter(h => {
    const targetDays = JSON.parse(h.targetDays || '[]');
    return targetDays.includes(selectedDate.getDay() || 7);
  });
  const isHabitCompleted = (id: string) =>
    todayEntries.some(e => e.habitId === id && e.completed && isSameDay(new Date(e.date), selectedDate));

  const filteredHabits = selectedCategory === 'all'
    ? habits
    : habits.filter(h => h.category === selectedCategory);
  const totalStreaks = Array.from(habitStreaks.values()).reduce((s, h) => s + h.currentStreak, 0);

  return (
    <SafeAreaView style={styles.root}>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {(['tasks', 'calendar', 'habits'] as Tab[]).map(tab => (
          <Pressable key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'tasks' ? 'TAREAS' : tab === 'calendar' ? 'CALENDARIO' : 'HÁBITOS'}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── TASKS ───────────────────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <View>
            {/* Date header */}
            <View style={styles.taskHeader}>
              <View style={styles.dateRow}>
                <Pressable
                  style={styles.navChevron}
                  onPress={() => {
                    const d = new Date(taskDate + 'T12:00:00');
                    d.setDate(d.getDate() - 1);
                    setTaskDate(d.toISOString().split('T')[0]);
                  }}
                >
                  <ChevronLeft size={20} color={OrialColors.textMuted} />
                </Pressable>

                <Pressable onPress={() => setTaskDate(todayStr)}>
                  <Text style={styles.dateLabel}>{taskDateLabel}</Text>
                  {taskDate !== todayStr && (
                    <Text style={styles.dateSub}>toca para volver a hoy</Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.navChevron}
                  onPress={() => {
                    const d = new Date(taskDate + 'T12:00:00');
                    d.setDate(d.getDate() + 1);
                    setTaskDate(d.toISOString().split('T')[0]);
                  }}
                >
                  <ChevronRight size={20} color={OrialColors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.headerRight}>
                {taskStreak > 0 && (
                  <View style={styles.streakBadge}>
                    <Flame size={13} color={OrialColors.warning} />
                    <Text style={styles.streakBadgeText}>{taskStreak}</Text>
                  </View>
                )}
                <Pressable style={styles.addBtn} onPress={() => setShowAddTask(true)}>
                  <Plus size={18} color="#fff" strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>

            {/* Completion progress */}
            {tasks.length > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` as any }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {completedCount} de {tasks.length} completadas
                </Text>
              </View>
            )}

            {/* Scheduled tasks */}
            {occupiedHours.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>PROGRAMADO</Text>
                <View style={styles.scheduleList}>
                  {occupiedHours.map(h =>
                    scheduledTasks
                      .filter(t => t.scheduledHour === h)
                      .map(t => (
                        <Pressable
                          key={t.id}
                          style={[styles.scheduledRow, t.completed && styles.scheduledRowDone]}
                          onPress={() => handleToggleTask(t.id)}
                        >
                          <Text style={styles.scheduleTime}>{formatHour(h)}</Text>
                          <View style={[
                            styles.scheduleDot,
                            { backgroundColor: t.priority === 1 ? OrialColors.warning : OrialColors.violet },
                            t.completed && { backgroundColor: OrialColors.success },
                          ]} />
                          <Text
                            style={[styles.scheduleTaskText, t.completed && styles.strikeText]}
                            numberOfLines={1}
                          >
                            {t.title}
                          </Text>
                          {t.completed && (
                            <Check size={13} color={OrialColors.success} />
                          )}
                        </Pressable>
                      ))
                  )}
                </View>
              </View>
            )}

            {/* Unscheduled tasks */}
            <View style={styles.section}>
              {unscheduledTasks.length > 0 && (
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionHeading}>SIN HORA</Text>
                  <Pressable onPress={handlePushToTomorrow} style={styles.pushBtn}>
                    <ArrowRight size={13} color={OrialColors.textMuted} />
                    <Text style={styles.pushBtnText}>aplazar al mañana</Text>
                  </Pressable>
                </View>
              )}

              {tasks.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Sin tareas. Toca + para añadir.</Text>
                </View>
              ) : (
                unscheduledTasks.map(t => (
                  <View key={t.id} style={[styles.taskRow, t.completed && styles.taskRowDone]}>
                    <Pressable
                      style={[styles.checkbox, t.completed && styles.checkboxDone]}
                      onPress={() => handleToggleTask(t.id)}
                    >
                      {t.completed && <Check size={11} color="#fff" strokeWidth={3} />}
                    </Pressable>
                    <View style={styles.taskBody}>
                      {t.priority === 1 && !t.completed && (
                        <View style={styles.priorityDot} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskText, t.completed && styles.strikeText]} numberOfLines={2}>
                          {t.title}
                        </Text>
                        {t.pushedFrom && (
                          <Text style={styles.pushedLabel}>aplazada</Text>
                        )}
                      </View>
                    </View>
                    <Pressable onPress={() => handleDeleteTask(t.id)} style={styles.deleteBtn}>
                      <Trash2 size={15} color={OrialColors.textMuted} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ── CALENDAR ────────────────────────────────────────────── */}
        {activeTab === 'calendar' && (
          <View>
            <View style={styles.calendarCard}>
              {/* Month navigation */}
              <View style={styles.monthNav}>
                <Pressable onPress={() => setCurrentMonth(subMonths(currentMonth, 1))} style={styles.navChevron}>
                  <ChevronLeft size={22} color={OrialColors.textSecondary} />
                </Pressable>
                <Text style={styles.monthTitle}>
                  {format(currentMonth, 'MMMM', { locale: es }).toUpperCase()}
                  {'  '}
                  <Text style={styles.monthYear}>{format(currentMonth, 'yyyy')}</Text>
                </Text>
                <Pressable onPress={() => setCurrentMonth(addMonths(currentMonth, 1))} style={styles.navChevron}>
                  <ChevronRight size={22} color={OrialColors.textSecondary} />
                </Pressable>
              </View>

              {/* Weekday headers */}
              <View style={styles.weekRow}>
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                  <View key={d} style={styles.dayCell}>
                    <Text style={styles.weekDayLabel}>{d}</Text>
                  </View>
                ))}
              </View>

              {/* Days — grouped by week so flex:1 fills exactly 7 columns */}
              {Array.from({ length: calendarDays.length / 7 }, (_, wi) =>
                calendarDays.slice(wi * 7, wi * 7 + 7)
              ).map((week, wi) => (
                <View key={wi} style={styles.weekRow}>
                  {week.map((day, di) => {
                    const inMonth = isSameMonth(day, currentMonth);
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    const hasEvt = events.some(e => isSameDay(new Date(e.startDate), day));

                    return (
                      <Pressable
                        key={di}
                        style={[
                          styles.dayCell,
                          styles.dayCellSquare,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => setSelectedDate(day)}
                      >
                        <Text style={[
                          styles.dayNumber,
                          !inMonth && styles.dayNumberMuted,
                          isSelected && styles.dayNumberSelected,
                          isToday && !isSelected && styles.dayNumberToday,
                        ]}>
                          {getDate(day)}
                        </Text>
                        {hasEvt && (
                          <View style={[styles.eventDot, isSelected && { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Selected day detail */}
            <View style={styles.section}>
              <Text style={styles.dayDetailTitle}>
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
              </Text>

              {selectedDateHabits.length > 0 && (
                <View style={styles.daySection}>
                  <Text style={styles.sectionHeading}>HÁBITOS</Text>
                  {selectedDateHabits.map(habit => (
                    <Pressable
                      key={habit.id}
                      style={styles.dayHabitRow}
                      onPress={() => toggleHabit(habit.id, selectedDate.toISOString().split('T')[0])}
                    >
                      <Text style={styles.habitEmojiSmall}>{habit.emoji}</Text>
                      <Text style={styles.dayHabitName}>{habit.name}</Text>
                      <View style={[styles.habitCheck, isHabitCompleted(habit.id) && styles.habitCheckDone]}>
                        {isHabitCompleted(habit.id) && (
                          <Check size={11} color="#fff" strokeWidth={3} />
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {selectedDateEvents.length > 0 && (
                <View style={styles.daySection}>
                  <Text style={styles.sectionHeading}>EVENTOS</Text>
                  {selectedDateEvents.map((event, i) => (
                    <View key={i} style={styles.eventRow}>
                      <Text style={styles.eventTime}>
                        {format(new Date(event.startDate), 'HH:mm')}
                      </Text>
                      <View style={styles.eventDivider} />
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        {event.notes && (
                          <Text style={styles.eventNotes}>{event.notes}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedDateHabits.length === 0 && selectedDateEvents.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Sin hábitos ni eventos este día.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── HABITS ──────────────────────────────────────────────── */}
        {activeTab === 'habits' && (
          <View>
            <View style={styles.habitsHeader}>
              <Text style={styles.habitsTitle}>Mis Hábitos</Text>
              <Pressable style={styles.addBtn} onPress={() => setIsCreationVisible(true)}>
                <Plus size={18} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>

            {totalStreaks > 0 && (
              <View style={styles.streakHero}>
                <Text style={styles.streakHeroNumber}>{totalStreaks}</Text>
                <View style={styles.streakHeroMeta}>
                  <Flame size={16} color={OrialColors.warning} />
                  <Text style={styles.streakHeroLabel}>días de racha total</Text>
                </View>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryList}
            >
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat.value}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.value && {
                      borderColor: cat.color,
                      backgroundColor: cat.color + '18',
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.value)}
                >
                  <Text style={[
                    styles.categoryChipLabel,
                    { color: selectedCategory === cat.value ? cat.color : OrialColors.textMuted },
                  ]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {filteredHabits.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {habits.length === 0 ? 'Sin hábitos. Crea el primero.' : 'Sin hábitos en esta categoría.'}
                </Text>
              </View>
            ) : (
              <View style={styles.habitsList}>
                {filteredHabits.map(habit => {
                  const streak = habitStreaks.get(habit.id);
                  const catColor = getCategoryColor(habit.category);
                  return (
                    <View key={habit.id} style={styles.habitCard}>
                      <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                      <View style={styles.habitInfo}>
                        <Text style={styles.habitName}>{habit.name}</Text>
                        <Text style={styles.habitMeta}>
                          {streak?.currentStreak || 0} días
                          {streak?.bestStreak ? ` · máx. ${streak.bestStreak}` : ''}
                          {streak?.completionRate ? ` · ${streak.completionRate}%` : ''}
                        </Text>
                      </View>
                      <View style={[styles.catBadge, { backgroundColor: catColor + '20' }]}>
                        <Text style={[styles.catBadgeLabel, { color: catColor }]}>
                          {habit.category}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Add Task Bottom Sheet ────────────────────────────────── */}
      <Modal visible={showAddTask} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.sheetContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddTask(false)} />
          <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nueva tarea</Text>
            <Pressable onPress={() => setShowAddTask(false)}>
              <X size={20} color={OrialColors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            style={styles.sheetInput}
            placeholder="¿Qué tienes que hacer?"
            placeholderTextColor={OrialColors.textMuted}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleAddTask}
          />

          <View style={styles.sheetOptions}>
            <Pressable
              style={[styles.optionChip, newTaskPriority === 1 && styles.optionChipActive]}
              onPress={() => setNewTaskPriority(newTaskPriority === 1 ? 0 : 1)}
            >
              <Star
                size={13}
                color={newTaskPriority === 1 ? OrialColors.warning : OrialColors.textMuted}
                fill={newTaskPriority === 1 ? OrialColors.warning : 'transparent'}
              />
              <Text style={[styles.optionChipLabel, newTaskPriority === 1 && { color: OrialColors.warning }]}>
                Prioritaria
              </Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourScroll}>
            <Pressable
              style={[styles.optionChip, newTaskHour === null && styles.optionChipActive]}
              onPress={() => setNewTaskHour(null)}
            >
              <Text style={[styles.optionChipLabel, newTaskHour === null && { color: OrialColors.textPrimary }]}>
                Sin hora
              </Text>
            </Pressable>
            {SCHEDULE_HOURS.map(h => (
              <Pressable
                key={h}
                style={[styles.optionChip, styles.hourChip, newTaskHour === h && styles.optionChipActive]}
                onPress={() => setNewTaskHour(h)}
              >
                <Text style={[styles.optionChipLabel, newTaskHour === h && { color: OrialColors.textPrimary }]}>
                  {formatHour(h)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[styles.sheetConfirm, !newTaskTitle.trim() && styles.sheetConfirmDisabled]}
            onPress={handleAddTask}
          >
            <Text style={styles.sheetConfirmText}>Añadir tarea</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <HabitCreationSheet
        visible={isCreationVisible}
        onClose={() => setIsCreationVisible(false)}
        onSave={(habitData: any) => {
          createHabit({ ...habitData, isArchived: false, isAiSuggested: false } as any);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 12,
    position: 'relative',
  },
  tabLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    color: OrialColors.textMuted,
  },
  tabLabelActive: {
    color: OrialColors.textPrimary,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: 40,
    backgroundColor: OrialColors.violetLight,
    borderRadius: 1,
  },

  // ── Shared
  navChevron: {
    padding: 4,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: OrialColors.textMuted,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: OrialColors.textMuted,
    textAlign: 'center',
  },

  // ── Tasks
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateLabel: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 22,
    color: OrialColors.textPrimary,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  dateSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 11,
    color: OrialColors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: OrialColors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  streakBadgeText: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: OrialColors.warning,
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    gap: 6,
  },
  progressTrack: {
    height: 2,
    backgroundColor: OrialColors.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: OrialColors.violetLight,
    borderRadius: 1,
  },
  progressLabel: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: OrialColors.textMuted,
  },
  scheduleList: {
    gap: 6,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  scheduledRowDone: {
    opacity: 0.45,
  },
  scheduleTime: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 13,
    color: OrialColors.textMuted,
    width: 36,
  },
  scheduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  scheduleTaskText: {
    flex: 1,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: OrialColors.textPrimary,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.border,
  },
  taskRowDone: {
    opacity: 0.5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: OrialColors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: OrialColors.success,
    borderColor: OrialColors.success,
  },
  taskBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: OrialColors.warning,
    flexShrink: 0,
  },
  taskText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: OrialColors.textPrimary,
    flex: 1,
  },
  pushedLabel: {
    fontFamily: 'Manrope-Regular',
    fontSize: 11,
    color: OrialColors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    color: OrialColors.textMuted,
  },
  deleteBtn: {
    padding: 4,
    opacity: 0.6,
  },
  pushBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pushBtnText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: OrialColors.textMuted,
  },

  // ── Calendar
  calendarCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: OrialColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OrialColors.border,
    padding: CAL_PAD,
    paddingBottom: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 20,
    color: OrialColors.textPrimary,
    letterSpacing: 1.5,
  },
  monthYear: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 20,
    color: OrialColors.textMuted,
    letterSpacing: 1.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 6,
  },
  dayCellSquare: {
    aspectRatio: 1,
    paddingVertical: 0,
  },
  dayCellSelected: {
    backgroundColor: OrialColors.violet,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: OrialColors.violetLight + '60',
  },
  weekDayLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: OrialColors.textMuted,
    textAlign: 'center',
  },
  dayNumber: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 15,
    color: OrialColors.textPrimary,
    textAlign: 'center',
  },
  dayNumberMuted: {
    color: OrialColors.textMuted,
    opacity: 0.35,
  },
  dayNumberSelected: {
    color: '#fff',
  },
  dayNumberToday: {
    color: OrialColors.violetLight,
  },
  eventDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: OrialColors.warning,
    position: 'absolute',
    bottom: 3,
  },
  dayDetailTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 20,
    color: OrialColors.textPrimary,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
    marginBottom: 20,
  },
  daySection: {
    marginBottom: 24,
  },
  dayHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.border,
  },
  habitEmojiSmall: {
    fontSize: 18,
  },
  dayHabitName: {
    flex: 1,
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: OrialColors.textPrimary,
  },
  habitCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: OrialColors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  habitCheckDone: {
    backgroundColor: OrialColors.success,
    borderColor: OrialColors.success,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.border,
  },
  eventTime: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 14,
    color: OrialColors.textMuted,
    width: 44,
    paddingTop: 1,
    letterSpacing: 0.3,
  },
  eventDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: OrialColors.border,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    color: OrialColors.textPrimary,
  },
  eventNotes: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: OrialColors.textMuted,
    marginTop: 2,
  },

  // ── Habits
  habitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 8,
  },
  habitsTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 26,
    color: OrialColors.textPrimary,
    letterSpacing: 0.3,
  },
  streakHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  streakHeroNumber: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 56,
    color: OrialColors.textPrimary,
    lineHeight: 60,
    letterSpacing: -1,
  },
  streakHeroMeta: {
    gap: 3,
  },
  streakHeroLabel: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: OrialColors.textMuted,
  },
  categoryScroll: {
    maxHeight: 46,
    marginBottom: 8,
  },
  categoryList: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  categoryChipLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
  },
  habitsList: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.border,
  },
  habitEmoji: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: OrialColors.textPrimary,
  },
  habitMeta: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: OrialColors.textMuted,
    marginTop: 2,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catBadgeLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
  },

  // ── Add task sheet
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: OrialColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: OrialColors.border,
    padding: 24,
    paddingBottom: 44,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: OrialColors.borderStrong,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: 'BarlowCondensed-Bold',
    fontSize: 22,
    color: OrialColors.textPrimary,
    letterSpacing: 0.3,
  },
  sheetInput: {
    backgroundColor: OrialColors.deepNavy,
    borderRadius: 10,
    padding: 14,
    fontFamily: 'Manrope-Regular',
    fontSize: 16,
    color: OrialColors.textPrimary,
    borderWidth: 1,
    borderColor: OrialColors.border,
    marginBottom: 14,
  },
  sheetOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  hourScroll: {
    marginBottom: 20,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: OrialColors.deepNavy,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  hourChip: {
    marginRight: 6,
  },
  optionChipActive: {
    borderColor: OrialColors.violetLight,
    backgroundColor: OrialColors.violet + '22',
  },
  optionChipLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: OrialColors.textMuted,
  },
  sheetConfirm: {
    backgroundColor: OrialColors.violet,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetConfirmDisabled: {
    opacity: 0.35,
  },
  sheetConfirmText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
