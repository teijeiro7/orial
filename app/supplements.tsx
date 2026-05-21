import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pill, Plus, Clock, Flame, ChevronLeft, TrendingUp, CalendarDays, CheckCircle2, XCircle, Info, Pencil, Check, X } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { supplementService } from '@/src/services/supplementService';
import type { Supplement } from '@/drizzle/schema';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SupplementsScreen() {
  const router = useRouter();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCreatineInfo, setShowCreatineInfo] = useState(false);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<Record<string, { date: string; doseMg: number; takenAt: Date | null; skipped: boolean }[]>>({});
  const [selectedSupplement, setSelectedSupplement] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<Record<string, boolean>>({});
  const [newSupplement, setNewSupplement] = useState({
    name: '',
    dailyDoseMg: '',
    reminderTime: '09:00',
    type: 'daily',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', dailyDoseMg: '', reminderTime: '' });

  const loadSupplements = useCallback(async () => {
    const supps = await supplementService.getSupplements();
    setSupplements(supps);

    const today = new Date().toISOString().split('T')[0];
    const logs = await supplementService.getTodayLogs(today.split('T')[0]);
    const todayMap: Record<string, boolean> = {};
    logs.forEach(l => {
      todayMap[l.supplementId] = !l.skipped && !!l.takenAt;
      const key = l.supplementId;
      if (!l.id && !l.takenAt) {
        todayMap[l.supplementId] = false;
      }
    });
    setTodayLogs(todayMap);

    const streakMap: Record<string, number> = {};
    for (const s of supps) {
      streakMap[s.id] = await supplementService.getStreak(s.id);
    }
    setStreaks(streakMap);

    const historyMap: Record<string, { date: string; doseMg: number; takenAt: Date | null; skipped: boolean }[]> = {};
    for (const s of supps) {
      historyMap[s.id] = await supplementService.getHistory(s.id, 14);
    }
    setHistory(historyMap);
  }, []);

  useEffect(() => {
    loadSupplements();
  }, [loadSupplements]);

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

  const handleLogToday = async (supplement: Supplement) => {
    const today = new Date().toISOString().split('T')[0];
    await supplementService.logSupplement(supplement.id, today, supplement.dailyDoseMg);
    loadSupplements();
  };

  const handleStartEdit = (supplement: Supplement) => {
    setEditingId(supplement.id);
    setEditForm({ name: supplement.name, dailyDoseMg: String(supplement.dailyDoseMg), reminderTime: supplement.reminderTime || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.name || !editForm.dailyDoseMg) return;
    await supplementService.updateSupplement(editingId, {
      name: editForm.name,
      dailyDoseMg: parseInt(editForm.dailyDoseMg),
      reminderTime: editForm.reminderTime || undefined,
    });
    setEditingId(null);
    loadSupplements();
  };

  const handleToggleActive = async (supplement: Supplement) => {
    if (supplement.isActive && supplement.reminderTime) {
      await supplementService.cancelReminders(supplement.id);
    }
    loadSupplements();
  };

  const getLast7Days = (): string[] => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const renderDayDots = (supplementId: string) => {
    const last7 = getLast7Days();
    const suppHistory = history[supplementId] || [];

    return (
      <View style={styles.dayDotsRow}>
        {last7.map((date, i) => {
          const entry = suppHistory.find(h => h.date === date);
          const taken = entry && !entry.skipped && !!entry.takenAt;
          return (
            <View key={i} style={styles.dayDotWrap}>
              <View style={[styles.dayDot, taken ? styles.dayDotTaken : styles.dayDotMissed]} />
              <Text style={styles.dayDotLabel}>{WEEKDAYS[i]}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderCreatineInfo = () => (
    <GlassCard style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <Info size={18} color={OrialColors.cyan} />
        <Text style={styles.infoTitle}>About Creatine</Text>
        <Pressable onPress={() => setShowCreatineInfo(false)}>
          <Text style={styles.infoClose}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.infoBody}>
        <Text style={styles.infoText}>
          <Text style={styles.infoBold}>Creatine Monohydrate{'\n'}</Text>
          The most researched supplement for strength, power, and muscle gains.
        </Text>
        <View style={styles.infoDivider} />
        <Text style={styles.infoSectionTitle}>Benefits</Text>
        <Text style={styles.infoBullet}>• Increases ATP production for explosive movements</Text>
        <Text style={styles.infoBullet}>• Improves strength, power output, and lean mass</Text>
        <Text style={styles.infoBullet}>• Enhances cognitive function and brain energy metabolism</Text>
        <Text style={styles.infoBullet}>• Supports muscle recovery and reduces fatigue</Text>
        <View style={styles.infoDivider} />
        <Text style={styles.infoSectionTitle}>Dosing</Text>
        <Text style={styles.infoBullet}>
          • Maintenance: <Text style={styles.infoBold}>5g daily</Text> to keep muscles saturated
        </Text>
        <Text style={styles.infoBullet}>
          • Loading (optional): 20g/day for 5-7 days to saturate faster
        </Text>
        <Text style={styles.infoBullet}>
          • Takes ~3-4 weeks at 5g/day to reach full saturation
        </Text>
        <Text style={styles.infoBullet}>
          • No need to cycle — creatine is safe for long-term daily use
        </Text>
        <View style={styles.infoDivider} />
        <Text style={styles.infoSectionTitle}>Tips</Text>
        <Text style={styles.infoBullet}>
          • Take with carbs or protein to improve muscle uptake
        </Text>
        <Text style={styles.infoBullet}>
          • Consistency matters more than timing — just take it daily
        </Text>
        <Text style={styles.infoBullet}>
          • Stay hydrated (creatine pulls water into muscles)
        </Text>
      </View>
    </GlassCard>
  );

  const renderSupplementDetail = (supplement: Supplement) => {
    const streak = streaks[supplement.id] || 0;
    const isCreatine = supplement.name.toLowerCase().includes('creatine') || supplement.type === 'creatine';
    const isEditing = editingId === supplement.id;

    return (
      <GlassCard key={supplement.id} style={styles.detailCard}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderLeft}>
            <View style={styles.detailIconWrap}>
              <Pill size={22} color={OrialColors.violetLight} />
            </View>
            <View>
              <Text style={styles.detailName}>{supplement.name}</Text>
              <Text style={styles.detailDose}>{supplement.dailyDoseMg}mg daily</Text>
            </View>
          </View>
          <View style={styles.detailHeaderActions}>
            <Pressable style={styles.editIconBtn} onPress={() => isEditing ? setEditingId(null) : handleStartEdit(supplement)}>
              {isEditing ? <X size={16} color={OrialColors.textMuted} /> : <Pencil size={16} color={OrialColors.textMuted} />}
            </Pressable>
            <Pressable
              style={[styles.takeButton, todayLogs[supplement.id] ? styles.takeButtonDone : styles.takeButtonPending]}
              onPress={() => !todayLogs[supplement.id] && handleLogToday(supplement)}
            >
              <Text style={[styles.takeButtonText, todayLogs[supplement.id] && styles.takeButtonTextDone]}>
                {todayLogs[supplement.id] ? '✓ Done' : 'Take now'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Edit form */}
        {isEditing && (
          <View style={styles.editForm}>
            <TextInput
              style={styles.editInput}
              value={editForm.name}
              onChangeText={(t) => setEditForm({ ...editForm, name: t })}
              placeholder="Name"
              placeholderTextColor={OrialColors.textMuted}
            />
            <TextInput
              style={styles.editInput}
              value={editForm.dailyDoseMg}
              onChangeText={(t) => setEditForm({ ...editForm, dailyDoseMg: t })}
              placeholder="Dose (mg)"
              placeholderTextColor={OrialColors.textMuted}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.editInput}
              value={editForm.reminderTime}
              onChangeText={(t) => setEditForm({ ...editForm, reminderTime: t })}
              placeholder="Reminder (HH:MM)"
              placeholderTextColor={OrialColors.textMuted}
            />
            <Pressable style={styles.saveEditBtn} onPress={handleSaveEdit}>
              <Check size={14} color={OrialColors.deepNavy} />
              <Text style={styles.saveEditText}>Save</Text>
            </Pressable>
          </View>
        )}

        {/* Streak */}
        <View style={styles.streakRow}>
          <Flame size={18} color={streak > 0 ? OrialColors.warning : OrialColors.textMuted} />
          <Text style={[styles.streakValue, { color: streak > 0 ? OrialColors.warning : OrialColors.textMuted }]}>
            {streak > 0 ? `${streak} day streak` : 'No active streak'}
          </Text>
          {streak >= 7 && (
            <View style={styles.streakBadge}>
              <TrendingUp size={12} color={OrialColors.success} />
              <Text style={styles.streakBadgeText}>Consistent</Text>
            </View>
          )}
        </View>

        {/* Last 7 days */}
        <View style={styles.historySection}>
          <Text style={styles.historyLabel}>LAST 7 DAYS</Text>
          {renderDayDots(supplement.id)}
        </View>

        {/* Reminder */}
        {supplement.reminderTime && (
          <View style={styles.reminderRow}>
            <Clock size={14} color={OrialColors.textMuted} />
            <Text style={styles.reminderText}>Reminder at {supplement.reminderTime}</Text>
          </View>
        )}

        {/* Info button for creatine */}
        {isCreatine && (
          <Pressable style={styles.infoButton} onPress={() => setShowCreatineInfo(!showCreatineInfo)}>
            <Info size={14} color={OrialColors.cyan} />
            <Text style={styles.infoButtonText}>About Creatine</Text>
          </Pressable>
        )}
      </GlassCard>
    );
  };

  const renderAddForm = () => (
    <GlassCard style={styles.addForm}>
      <Text style={styles.formTitle}>Add Supplement</Text>
      <TextInput
        style={styles.input}
        placeholder="Name (e.g., Creatine Monohydrate)"
        placeholderTextColor={OrialColors.textMuted}
        value={newSupplement.name}
        onChangeText={(t) => setNewSupplement({ ...newSupplement, name: t })}
      />
      <TextInput
        style={styles.input}
        placeholder="Daily dose (mg)"
        placeholderTextColor={OrialColors.textMuted}
        value={newSupplement.dailyDoseMg}
        onChangeText={(t) => setNewSupplement({ ...newSupplement, dailyDoseMg: t })}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Reminder time (HH:MM)"
        placeholderTextColor={OrialColors.textMuted}
        value={newSupplement.reminderTime}
        onChangeText={(t) => setNewSupplement({ ...newSupplement, reminderTime: t })}
      />
      <View style={styles.formActions}>
        <Pressable style={styles.cancelButton} onPress={() => setShowAddForm(false)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={handleAdd}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </GlassCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={20} color={OrialColors.textSecondary} />
            </Pressable>
            <Text style={styles.headerTitle}>Supplements</Text>
            <View style={styles.backButton} />
          </View>
          <Text style={styles.headerSub}>Track your daily intake and streaks</Text>
        </View>

        {/* Supplement cards */}
        {supplements.map(renderSupplementDetail)}

        {/* Creatine info panel */}
        {showCreatineInfo && renderCreatineInfo()}

        {/* Recent History Table */}
        {supplements.length > 0 && (
          <View style={styles.historyTableSection}>
            <Text style={styles.sectionLabel}>RECENT HISTORY</Text>
            <GlassCard style={styles.historyTableCard}>
              <View style={styles.historyTableHeader}>
                <Text style={[styles.historyTableCell, styles.historyTableHeaderText, { flex: 1.5 }]}>Date</Text>
                <Text style={[styles.historyTableCell, styles.historyTableHeaderText, { flex: 1 }]}>Dose</Text>
                <Text style={[styles.historyTableCell, styles.historyTableHeaderText, { flex: 0.8 }]}>Status</Text>
              </View>
              {supplements.flatMap(s => 
                (history[s.id] || []).slice(0, 10).map((entry, i) => (
                  <View key={`${s.id}-${i}`} style={styles.historyTableRow}>
                    <Text style={[styles.historyTableCell, { flex: 1.5 }]}>
                      {entry.date.split('-').slice(1).join('/')}
                    </Text>
                    <Text style={[styles.historyTableCell, { flex: 1 }]}>{entry.doseMg}mg</Text>
                    <View style={[styles.historyTableStatus, { flex: 0.8 }]}>
                      {entry.skipped ? (
                        <>
                          <XCircle size={12} color={OrialColors.error} />
                          <Text style={styles.historyTableSkipped}>Skipped</Text>
                        </>
                      ) : entry.takenAt ? (
                        <>
                          <CheckCircle2 size={12} color={OrialColors.success} />
                          <Text style={styles.historyTableTaken}>Done</Text>
                        </>
                      ) : (
                        <Text style={styles.historyTableMissed}>Pending</Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </GlassCard>
          </View>
        )}

        {/* Add form or button */}
        {showAddForm ? (
          renderAddForm()
        ) : supplements.length === 0 ? (
          <View style={styles.emptyState}>
            <Pill size={40} color={OrialColors.textMuted} />
            <Text style={styles.emptyTitle}>No supplements yet</Text>
            <Text style={styles.emptySub}>Tap below to add creatine or other supplements</Text>
          </View>
        ) : null}

        <Pressable style={styles.addButton} onPress={() => setShowAddForm(true)}>
          <Plus size={20} color={OrialColors.deepNavy} />
          <Text style={styles.addButtonText}>
            {showAddForm ? 'Close' : supplements.length > 0 ? 'Add Another' : 'Add Supplement'}
          </Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: OrialColors.textMuted, textAlign: 'center', fontFamily: 'Inter-Regular' },

  detailCard: { marginHorizontal: 16, marginBottom: 12, padding: 16 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  detailIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: OrialColors.violet + '18', alignItems: 'center', justifyContent: 'center' },
  detailName: { fontSize: 18, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold' },
  detailDose: { fontSize: 12, color: OrialColors.textMuted, marginTop: 2, fontFamily: 'Inter-Regular' },

  detailHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editIconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: OrialColors.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: OrialColors.border },
  editForm: { marginBottom: 12, gap: 8 },
  editInput: { backgroundColor: OrialColors.surface, borderRadius: 10, padding: 12, color: OrialColors.textPrimary, fontSize: 14, fontFamily: 'Inter-Regular', borderWidth: 1, borderColor: OrialColors.border },
  saveEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OrialColors.violet, borderRadius: 10, padding: 12 },
  saveEditText: { color: OrialColors.textPrimary, fontWeight: '600', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  takeButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 90, alignItems: 'center', borderWidth: 1 },
  takeButtonPending: { backgroundColor: OrialColors.violet + '20', borderColor: OrialColors.violet + '45' },
  takeButtonDone: { backgroundColor: OrialColors.success + '12', borderColor: OrialColors.success + '35' },
  takeButtonText: { fontWeight: '600', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  takeButtonTextDone: { color: OrialColors.success },

  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: OrialColors.surfaceElevated, borderRadius: 10 },
  streakValue: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: OrialColors.success + '15', borderRadius: 6, borderWidth: 1, borderColor: OrialColors.success + '25' },
  streakBadgeText: { fontSize: 10, color: OrialColors.success, fontFamily: 'Inter-SemiBold', letterSpacing: 0.3 },

  dayDotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  dayDotWrap: { alignItems: 'center', gap: 4 },
  dayDot: { width: 10, height: 10, borderRadius: 3 },
  dayDotTaken: { backgroundColor: OrialColors.success },
  dayDotMissed: { backgroundColor: OrialColors.surfaceElevated, borderWidth: 1, borderColor: OrialColors.border },
  dayDotLabel: { fontSize: 8, color: OrialColors.textMuted, fontFamily: 'Inter-Medium' },

  historySection: { marginBottom: 12 },
  historyLabel: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, fontFamily: 'Inter-Medium' },

  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  reminderText: { fontSize: 12, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },

  infoButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: OrialColors.cyan + '10', borderRadius: 8, borderWidth: 1, borderColor: OrialColors.cyan + '22', alignSelf: 'flex-start' },
  infoButtonText: { fontSize: 12, color: OrialColors.cyan, fontFamily: 'Inter-SemiBold' },

  infoCard: { marginHorizontal: 16, marginBottom: 12, padding: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: OrialColors.textPrimary, flex: 1, fontFamily: 'Inter-Bold' },
  infoClose: { fontSize: 18, color: OrialColors.textMuted, padding: 4 },
  infoBody: {},
  infoText: { fontSize: 13, color: OrialColors.textSecondary, lineHeight: 20, fontFamily: 'Inter-Regular' },
  infoBold: { fontWeight: '700', color: OrialColors.textPrimary },
  infoSectionTitle: { fontSize: 13, fontWeight: '700', color: OrialColors.cyan, marginBottom: 6, marginTop: 4, fontFamily: 'Inter-Bold' },
  infoBullet: { fontSize: 13, color: OrialColors.textSecondary, lineHeight: 20, marginBottom: 4, fontFamily: 'Inter-Regular' },
  infoDivider: { height: 1, backgroundColor: OrialColors.border, marginVertical: 12 },

  historyTableSection: { marginHorizontal: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 9, letterSpacing: 1.5, color: OrialColors.textMuted, marginBottom: 10, marginLeft: 2, fontFamily: 'Inter-Medium' },
  historyTableCard: { padding: 12 },
  historyTableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: OrialColors.border, paddingBottom: 8, marginBottom: 4 },
  historyTableHeaderText: { color: OrialColors.textMuted, fontSize: 10, letterSpacing: 0.5, fontFamily: 'Inter-SemiBold' },
  historyTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: OrialColors.border },
  historyTableCell: { fontSize: 12, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
  historyTableStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyTableTaken: { fontSize: 11, color: OrialColors.success, fontFamily: 'Inter-SemiBold' },
  historyTableSkipped: { fontSize: 11, color: OrialColors.error, fontFamily: 'Inter-SemiBold' },
  historyTableMissed: { fontSize: 11, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: OrialColors.textSecondary, fontFamily: 'Inter-Bold' },
  emptySub: { fontSize: 13, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },

  addForm: { marginHorizontal: 16, marginBottom: 12, padding: 16 },
  formTitle: { fontSize: 17, fontWeight: '700', color: OrialColors.textPrimary, marginBottom: 16, fontFamily: 'Inter-Bold' },
  input: { backgroundColor: OrialColors.surface, borderRadius: 12, padding: 14, color: OrialColors.textPrimary, fontSize: 15, marginBottom: 12, fontFamily: 'Inter-Regular', borderWidth: 1, borderColor: OrialColors.border },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: OrialColors.surface, alignItems: 'center', borderWidth: 1, borderColor: OrialColors.border },
  cancelText: { color: OrialColors.textSecondary, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  saveButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: OrialColors.violet, alignItems: 'center' },
  saveText: { color: OrialColors.textPrimary, fontWeight: '600', fontFamily: 'Inter-SemiBold' },

  addButton: { backgroundColor: OrialColors.violet, marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  addButtonText: { color: OrialColors.textPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'Inter-Bold' },
});
