import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { X, Clock, Calendar } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';
import { GlassCard } from './GlassCard';
import type { Habit } from '../../drizzle/schema';

interface ReminderCreationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reminder: {
    habitId: string;
    time: string;
    days: number[];
    isActive: boolean;
  }) => void;
  habits: Habit[];
  preselectedHabitId?: string;
}

const WEEK_DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
];

export function ReminderCreationSheet({ 
  visible, 
  onClose, 
  onSave, 
  habits,
  preselectedHabitId 
}: ReminderCreationSheetProps) {
  const [selectedHabitId, setSelectedHabitId] = useState(preselectedHabitId || '');
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isActive, setIsActive] = useState(true);

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setTime(selectedDate);
    }
  };

  const handleSave = () => {
    if (!selectedHabitId) return;

    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');

    onSave({
      habitId: selectedHabitId,
      time: `${hours}:${minutes}`,
      days: selectedDays,
      isActive,
    });

    // Reset form
    setSelectedHabitId(preselectedHabitId || '');
    setTime(new Date());
    setSelectedDays([1, 2, 3, 4, 5]);
    setIsActive(true);
    onClose();
  };

  const selectedHabit = habits.find(h => h.id === selectedHabitId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>New Reminder</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Habit</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.habitsContainer}
            >
              {habits.map(habit => (
                <Pressable
                  key={habit.id}
                  onPress={() => setSelectedHabitId(habit.id)}
                  style={[
                    styles.habitChip,
                    selectedHabitId === habit.id && { 
                      backgroundColor: OrialColors.violet + '30',
                      borderColor: OrialColors.violet 
                    }
                  ]}
                >
                  <Text style={styles.habitEmoji}>{habit.emoji}</Text>
                  <Text style={[
                    OrialTypography.bodySmall,
                    { color: selectedHabitId === habit.id ? OrialColors.textPrimary : OrialColors.textSecondary }
                  ]}>
                    {habit.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Time</Text>
            <Pressable 
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Clock size={20} color={OrialColors.violetLight} />
              <Text style={OrialTypography.headingMedium}>
                {time.getHours().toString().padStart(2, '0')}:
                {time.getMinutes().toString().padStart(2, '0')}
              </Text>
            </Pressable>

            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                is24Hour={true}
                onChange={handleTimeChange}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Repeat Days</Text>
            <View style={styles.daysRow}>
              {WEEK_DAYS.map(day => (
                <Pressable
                  key={day.value}
                  onPress={() => toggleDay(day.value)}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day.value) && { backgroundColor: OrialColors.violet }
                  ]}
                >
                  <Text style={[
                    OrialTypography.caption,
                    selectedDays.includes(day.value) && { color: OrialColors.textPrimary }
                  ]}>
                    {day.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={OrialTypography.bodyMedium}>Active</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: OrialColors.surface, true: OrialColors.violet }}
                thumbColor={OrialColors.textPrimary}
              />
            </View>
          </View>

          <Pressable 
            style={[styles.saveButton, !selectedHabitId && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!selectedHabitId}
          >
            <Text style={[OrialTypography.button, styles.saveButtonText]}>Create Reminder</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  habitsContainer: {
    gap: 8,
    paddingRight: 16,
  },
  habitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  habitEmoji: {
    fontSize: 20,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: OrialColors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: OrialColors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  saveButton: {
    backgroundColor: OrialColors.violet,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: OrialColors.textPrimary,
  },
});
