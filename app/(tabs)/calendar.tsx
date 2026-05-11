import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDate, getDay } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { calendarService } from '../../src/services/calendarService';
import { useHabitStore } from '../../src/stores/habitStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_SIZE = (SCREEN_WIDTH - 64) / 7;

export default function CalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const { habits, todayEntries, loadHabits } = useHabitStore();

  useEffect(() => {
    loadHabits();
    loadEvents();
  }, [currentMonth]);

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
    const dayOfWeek = selectedDate.getDay() || 7; // Convert Sunday (0) to 7
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Calendar</Text>
        </View>

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
                  {dayHasEvents && (
                    <View style={styles.eventDot} />
                  )}
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
              {selectedDateHabits.map(habit => (
                <GlassCard key={habit.id} style={styles.habitItem}>
                  <View style={styles.habitRow}>
                    <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                    <Text style={OrialTypography.bodyMedium}>{habit.name}</Text>
                    <View style={[
                      styles.checkIndicator,
                      isHabitCompleted(habit.id) && { backgroundColor: OrialColors.success }
                    ]}>
                      {isHabitCompleted(habit.id) && (
                        <Text style={styles.checkText}>✓</Text>
                      )}
                    </View>
                  </View>
                </GlassCard>
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
    padding: 16,
    paddingBottom: 8,
  },
  calendarCard: {
    margin: 16,
    marginTop: 0,
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
  checkText: {
    color: OrialColors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
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
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    textAlign: 'center',
  },
});
