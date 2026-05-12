import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';
import { GlassCard } from './GlassCard';

interface HabitCreationSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (habit: {
    name: string;
    emoji: string;
    category: string;
    frequency: string;
    targetDays: number[];
    targetCount: number;
    description?: string;
  }) => void;
}

const CATEGORIES = [
  { value: 'health', label: 'Health', color: OrialColors.categoryHealth },
  { value: 'mind', label: 'Mind', color: OrialColors.categoryMind },
  { value: 'work', label: 'Work', color: OrialColors.categoryWork },
  { value: 'social', label: 'Social', color: OrialColors.categorySocial },
  { value: 'fitness', label: 'Fitness', color: OrialColors.categoryFitness },
  { value: 'learning', label: 'Learning', color: OrialColors.categoryLearn },
  { value: 'other', label: 'Other', color: OrialColors.categoryOther },
];

const WEEK_DAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 },
];

const EMOJIS = ['✅', '🧘', '📖', '🚿', '🏃', '💪', '🥗', '💧', '📝', '🎸', '🎨', '💻', '🌱', '☀️', '🌙'];

export function HabitCreationSheet({ visible, onClose, onSave }: HabitCreationSheetProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✅');
  const [category, setCategory] = useState('health');
  const [frequency, setFrequency] = useState('daily');
  const [targetDays, setTargetDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetCount, setTargetCount] = useState(1);
  const [description, setDescription] = useState('');

  const toggleDay = (day: number) => {
    setTargetDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      emoji,
      category,
      frequency,
      targetDays: frequency === 'daily' ? [1,2,3,4,5,6,7] : targetDays,
      targetCount,
      description: description.trim() || undefined,
    });
    
    // Reset form
    setName('');
    setEmoji('✅');
    setCategory('health');
    setFrequency('daily');
    setTargetDays([1, 2, 3, 4, 5]);
    setTargetCount(1);
    setDescription('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>New Habit</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Meditate 10 min"
              placeholderTextColor={OrialColors.textMuted}
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[
                    styles.emojiButton,
                    emoji === e && { backgroundColor: OrialColors.violet }
                  ]}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(cat.value)}
                  style={[
                    styles.categoryButton,
                    category === cat.value && { backgroundColor: cat.color + '40', borderColor: cat.color }
                  ]}
                >
                  <Text style={[OrialTypography.bodySmall, { color: cat.color }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Frequency</Text>
            <View style={styles.frequencyRow}>
              {['daily', 'weekly', 'custom'].map(freq => (
                <Pressable
                  key={freq}
                  onPress={() => setFrequency(freq)}
                  style={[
                    styles.frequencyButton,
                    frequency === freq && { backgroundColor: OrialColors.violet }
                  ]}
                >
                  <Text style={[
                    OrialTypography.bodySmall,
                    frequency === freq && { color: OrialColors.textPrimary }
                  ]}>
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {frequency === 'custom' && (
            <View style={styles.section}>
              <Text style={[OrialTypography.caption, styles.label]}>Target Days</Text>
              <View style={styles.daysRow}>
                {WEEK_DAYS.map(day => (
                  <Pressable
                    key={day.value}
                    onPress={() => toggleDay(day.value)}
                    style={[
                      styles.dayButton,
                      targetDays.includes(day.value) && { backgroundColor: OrialColors.violet }
                    ]}
                  >
                    <Text style={[
                      OrialTypography.caption,
                      targetDays.includes(day.value) && { color: OrialColors.textPrimary }
                    ]}>
                      {day.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[OrialTypography.caption, styles.label]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a note about this habit..."
              placeholderTextColor={OrialColors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable 
            style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <Text style={[OrialTypography.button, styles.saveButtonText]}>Create Habit</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 16,
    color: OrialColors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: OrialColors.surface,
  },
  emojiText: {
    fontSize: 24,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    alignItems: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
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
