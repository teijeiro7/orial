import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../src/components/GlassCard';
import { ReminderCreationSheet } from '../../src/components/ReminderCreationSheet';
import { useHabitStore } from '../../src/stores/habitStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { ChevronRight, Bell, Trash2 } from 'lucide-react-native';
import { useState, useEffect } from 'react';

export default function SettingsScreen() {
  const { habits, reminders, loadReminders, loadHabits, deleteReminder } = useHabitStore();
  const [isReminderSheetVisible, setIsReminderSheetVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    loadHabits();
    loadReminders();
  }, []);

  const getDayLabels = (daysJson: string) => {
    try {
      const days = JSON.parse(daysJson);
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map((d: number) => dayNames[d - 1]).join(', ');
    } catch {
      return 'Daily';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Settings</Text>
        </View>
        
        <GlassCard style={styles.card}>
          <View style={styles.settingItem}>
            <Text style={OrialTypography.bodyMedium}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: OrialColors.surface, true: OrialColors.violet }}
              thumbColor={OrialColors.textPrimary}
            />
          </View>
        </GlassCard>

        <View style={styles.sectionHeader}>
          <Text style={OrialTypography.headingSmall}>Reminders</Text>
          <Pressable 
            style={styles.addButton}
            onPress={() => setIsReminderSheetVisible(true)}
          >
            <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>+ Add</Text>
          </Pressable>
        </View>

        {reminders.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
              No reminders yet. Tap "+ Add" to create one!
            </Text>
          </GlassCard>
        ) : (
          <View style={styles.remindersList}>
            {reminders.map(reminder => {
              const habit = habits.find(h => h.id === reminder.habitId);
              return (
                <GlassCard key={reminder.id} style={styles.reminderItem}>
                  <View style={styles.reminderRow}>
                    <View style={styles.reminderInfo}>
                      <Text style={OrialTypography.bodyMedium}>
                        {habit?.emoji} {habit?.name || 'Unknown Habit'}
                      </Text>
                      <Text style={OrialTypography.caption}>
                        {reminder.time} · {getDayLabels(reminder.days)}
                      </Text>
                    </View>
                    <Pressable 
                      onPress={() => deleteReminder(reminder.id)}
                      style={styles.deleteButton}
                    >
                      <Trash2 size={18} color={OrialColors.error} />
                    </Pressable>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Integrations</Text>
          <GlassCard>
            <SettingItem title="Notion Sync" />
            <SettingItem title="Calendar" />
            <SettingItem title="Appearance" />
          </GlassCard>
        </View>
      </ScrollView>

      <ReminderCreationSheet
        visible={isReminderSheetVisible}
        onClose={() => setIsReminderSheetVisible(false)}
        habits={habits}
        onSave={async (reminderData) => {
          const { createReminder } = useHabitStore.getState();
          await createReminder({
            ...reminderData,
            days: JSON.stringify(reminderData.days),
            calendarEventId: null,
          });
        }}
      />
    </SafeAreaView>
  );
}

function SettingItem({ title }: { title: string }) {
  return (
    <Pressable style={styles.settingItem}>
      <Text style={OrialTypography.bodyMedium}>{title}</Text>
      <ChevronRight size={20} color={OrialColors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  card: {
    marginBottom: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
  },
  remindersList: {
    gap: 8,
    marginBottom: 16,
  },
  reminderItem: {
    padding: 16,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
});
