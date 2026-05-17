import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Pill, Plus, Clock } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { supplementService } from '@/src/services/supplementService';
import type { Supplement } from '@/drizzle/schema';

export default function SupplementsScreen() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplement, setNewSupplement] = useState({
    name: '',
    dailyDoseMg: '',
    reminderTime: '09:00',
    type: 'daily',
  });

  const loadSupplements = async () => {
    const supps = await supplementService.getSupplements();
    setSupplements(supps);
  };

  useEffect(() => {
    loadSupplements();
  }, []);

  const handleAdd = async () => {
    if (!newSupplement.name || !newSupplement.dailyDoseMg) return;
    
    await supplementService.createSupplement({
      name: newSupplement.name,
      dailyDoseMg: parseInt(newSupplement.dailyDoseMg),
      reminderTime: newSupplement.reminderTime,
      type: newSupplement.type,
      isActive: true,
    });

    setNewSupplement({ name: '', dailyDoseMg: '', reminderTime: '09:00', type: 'daily' });
    setShowAddForm(false);
    loadSupplements();
  };

  const handleToggleActive = async (supplement: Supplement) => {
    // Since we don't have an update method, we'll cancel reminders if disabling
    if (supplement.isActive && supplement.reminderTime) {
      await supplementService.cancelReminders(supplement.id);
    }
    // Note: In a real app, you'd update the isActive field in the database
    // For now, we'll just reload to show current state
    loadSupplements();
  };

  const handleLogToday = async (supplement: Supplement) => {
    const today = new Date().toISOString().split('T')[0];
    await supplementService.logSupplement(supplement.id, today, supplement.dailyDoseMg);
    loadSupplements();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Supplements</Text>
          <Text style={OrialTypography.caption}>Track your daily supplement intake</Text>
        </View>

        {supplements.map((supplement) => (
          <GlassCard key={supplement.id} style={styles.supplementCard}>
            <View style={styles.supplementHeader}>
              <View style={styles.supplementInfo}>
                <Pill size={20} color={OrialColors.violetLight} />
                <View>
                  <Text style={OrialTypography.headingSmall}>{supplement.name}</Text>
                  <Text style={OrialTypography.caption}>{supplement.dailyDoseMg}mg {supplement.type}</Text>
                </View>
              </View>
              <Switch
                value={supplement.isActive}
                onValueChange={() => handleToggleActive(supplement)}
                trackColor={{ false: OrialColors.surface, true: OrialColors.violet + '50' }}
                thumbColor={supplement.isActive ? OrialColors.violetLight : OrialColors.textMuted}
              />
            </View>

            {supplement.reminderTime && (
              <View style={styles.reminderRow}>
                <Clock size={14} color={OrialColors.textMuted} />
                <Text style={[OrialTypography.caption, styles.reminderText]}>
                  Reminder at {supplement.reminderTime}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.logButton}
              onPress={() => handleLogToday(supplement)}
            >
              <Text style={styles.logButtonText}>Log Today</Text>
            </Pressable>
          </GlassCard>
        ))}

        {showAddForm ? (
          <GlassCard style={styles.addForm}>
            <Text style={[OrialTypography.headingSmall, styles.formTitle]}>Add Supplement</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Name (e.g., Creatine Monohydrate)"
              placeholderTextColor={OrialColors.textMuted}
              value={newSupplement.name}
              onChangeText={(text) => setNewSupplement({ ...newSupplement, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Daily dose (mg)"
              placeholderTextColor={OrialColors.textMuted}
              value={newSupplement.dailyDoseMg}
              onChangeText={(text) => setNewSupplement({ ...newSupplement, dailyDoseMg: text })}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Reminder time (HH:MM)"
              placeholderTextColor={OrialColors.textMuted}
              value={newSupplement.reminderTime}
              onChangeText={(text) => setNewSupplement({ ...newSupplement, reminderTime: text })}
            />

            <View style={styles.formActions}>
              <Pressable style={styles.cancelButton} onPress={() => setShowAddForm(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleAdd}>
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowAddForm(true)}>
            <Plus size={20} color={OrialColors.deepNavy} />
            <Text style={styles.addButtonText}>Add Supplement</Text>
          </Pressable>
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
    padding: 20,
    paddingBottom: 8,
  },
  supplementCard: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
  },
  supplementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  reminderText: {
    color: OrialColors.textMuted,
  },
  logButton: {
    backgroundColor: OrialColors.violet + '30',
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  logButtonText: {
    color: OrialColors.violetLight,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: OrialColors.violet,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: OrialColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  addForm: {
    margin: 16,
    padding: 16,
  },
  formTitle: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 14,
    color: OrialColors.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: OrialColors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: OrialColors.violet,
    alignItems: 'center',
  },
  saveButtonText: {
    color: OrialColors.textPrimary,
    fontWeight: '600',
  },
});
