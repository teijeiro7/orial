import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  Trash2,
  TrendingUp,
  Check,
  X,
} from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { gymService } from '../../src/services/gymService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { GymRoutine, GymExercise, GymSession, GymSet } from '../../drizzle/schema';
import type { OverloadAlert } from '../../src/services/gymService';

type ScreenView = 'routines' | 'session';

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GymScreen() {
  const [view, setView] = useState<ScreenView>('routines');
  const [routines, setRoutines] = useState<GymRoutine[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<GymRoutine | null>(null);
  const [exercises, setExercises] = useState<GymExercise[]>([]);
  const [activeSession, setActiveSession] = useState<GymSession | null>(null);
  const [sessionSets, setSessionSets] = useState<GymSet[]>([]);
  const [overloadAlerts, setOverloadAlerts] = useState<OverloadAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [logReps, setLogReps] = useState<Record<string, string>>({});
  const [logWeight, setLogWeight] = useState<Record<string, string>>({});

  // New routine form
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineEmoji, setNewRoutineEmoji] = useState('💪');
  const [newRoutineDays, setNewRoutineDays] = useState<number[]>([]);

  // New exercise form
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState('3');
  const [newExRepsMin, setNewExRepsMin] = useState('8');
  const [newExRepsMax, setNewExRepsMax] = useState('12');
  const [newExWeight, setNewExWeight] = useState('0');
  const [newExIncrement, setNewExIncrement] = useState('2.5');

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    const r = await gymService.getRoutines();
    setRoutines(r);
    setLoading(false);
  }, []);

  const loadRoutineDetail = useCallback(async (routine: GymRoutine) => {
    const [exs, alerts, session] = await Promise.all([
      gymService.getExercisesForRoutine(routine.id),
      gymService.checkOverloadAlerts(routine.id),
      gymService.getTodaySession(routine.id),
    ]);
    setExercises(exs);
    setOverloadAlerts(alerts);
    if (session) {
      const sets = await gymService.getSetsForSession(session.id);
      setActiveSession(session);
      setSessionSets(sets);
    } else {
      setActiveSession(null);
      setSessionSets([]);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
  }, []);

  useEffect(() => {
    if (activeRoutine) loadRoutineDetail(activeRoutine);
  }, [activeRoutine]);

  async function handleCreateRoutine() {
    if (!newRoutineName.trim()) return;
    await gymService.createRoutine(newRoutineName.trim(), newRoutineEmoji, newRoutineDays);
    setNewRoutineName('');
    setNewRoutineEmoji('💪');
    setNewRoutineDays([]);
    setShowAddRoutine(false);
    loadRoutines();
  }

  async function handleCreateExercise() {
    if (!activeRoutine || !newExName.trim()) return;
    await gymService.createExercise({
      routineId: activeRoutine.id,
      name: newExName.trim(),
      targetSets: parseInt(newExSets) || 3,
      targetRepsMin: parseInt(newExRepsMin) || 8,
      targetRepsMax: parseInt(newExRepsMax) || 12,
      currentWeightKg: parseFloat(newExWeight) || 0,
      incrementKg: parseFloat(newExIncrement) || 2.5,
    });
    setNewExName('');
    setNewExSets('3');
    setNewExRepsMin('8');
    setNewExRepsMax('12');
    setNewExWeight('0');
    setNewExIncrement('2.5');
    setShowAddExercise(false);
    loadRoutineDetail(activeRoutine);
  }

  async function handleStartSession() {
    if (!activeRoutine) return;
    const session = await gymService.startSession(activeRoutine.id);
    setActiveSession(session);
    setSessionSets([]);
  }

  async function handleLogSet(exercise: GymExercise) {
    if (!activeSession) return;
    const reps = parseInt(logReps[exercise.id] || '0');
    const weight = parseFloat(logWeight[exercise.id] || String(exercise.currentWeightKg));
    if (!reps) return;

    const setsForExercise = sessionSets.filter((s) => s.exerciseId === exercise.id);
    const set = await gymService.logSet({
      sessionId: activeSession.id,
      exerciseId: exercise.id,
      setNumber: setsForExercise.length + 1,
      reps,
      weightKg: weight,
    });

    setSessionSets((prev) => [...prev, set]);
    setLogReps((prev) => ({ ...prev, [exercise.id]: '' }));
  }

  async function handleAcceptOverload(alert: OverloadAlert) {
    await gymService.updateExerciseWeight(alert.exerciseId, alert.nextWeightKg);
    setOverloadAlerts((prev) => prev.filter((a) => a.exerciseId !== alert.exerciseId));
    if (activeRoutine) loadRoutineDetail(activeRoutine);
    Alert.alert('Weight updated!', `${alert.exerciseName}: ${alert.nextWeightKg} kg`);
  }

  function getExerciseSets(exerciseId: string) {
    return sessionSets.filter((s) => s.exerciseId === exerciseId);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={OrialColors.violet} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ── Routine list view ────────────────────────────────────────────────────
  if (view === 'routines' || !activeRoutine) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Gym</Text>
          <Pressable style={styles.addButton} onPress={() => setShowAddRoutine(true)}>
            <Plus size={20} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {routines.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Dumbbell size={32} color={OrialColors.textMuted} />
              <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                No routines yet. Create your first.
              </Text>
            </GlassCard>
          ) : (
            <View style={styles.section}>
              {routines.map((r) => {
                const days: number[] = JSON.parse(r.days || '[]');
                return (
                  <Pressable key={r.id} onPress={() => { setActiveRoutine(r); setView('session'); }}>
                    <GlassCard style={styles.routineCard}>
                      <View style={styles.routineRow}>
                        <Text style={styles.routineEmoji}>{r.emoji}</Text>
                        <View style={styles.routineInfo}>
                          <Text style={OrialTypography.bodyMedium}>{r.name}</Text>
                          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                            {days.map((d) => DAY_LABELS[d]).join(', ') || 'No days set'}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={OrialColors.textMuted} />
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Add Routine Modal */}
        <Modal visible={showAddRoutine} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <GlassCard style={styles.modalCard}>
              <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Routine</Text>

              <TextInput
                style={styles.input}
                placeholder="Routine name (e.g. Push)"
                placeholderTextColor={OrialColors.textMuted}
                value={newRoutineName}
                onChangeText={setNewRoutineName}
              />

              <TextInput
                style={styles.input}
                placeholder="Emoji"
                placeholderTextColor={OrialColors.textMuted}
                value={newRoutineEmoji}
                onChangeText={setNewRoutineEmoji}
                maxLength={2}
              />

              <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginBottom: 8 }]}>
                Days
              </Text>
              <View style={styles.daysRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.dayChip,
                      newRoutineDays.includes(d) && styles.dayChipActive,
                    ]}
                    onPress={() =>
                      setNewRoutineDays((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                      )
                    }
                  >
                    <Text
                      style={[
                        OrialTypography.caption,
                        { color: newRoutineDays.includes(d) ? '#fff' : OrialColors.textMuted },
                      ]}
                    >
                      {DAY_LABELS[d].slice(0, 2)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowAddRoutine(false)}>
                  <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleCreateRoutine}>
                  <Text style={OrialTypography.bodyMedium}>Create</Text>
                </Pressable>
              </View>
            </GlassCard>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── Session view ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => { setView('routines'); setActiveRoutine(null); }}>
          <X size={22} color={OrialColors.textMuted} />
        </Pressable>
        <Text style={OrialTypography.headingMedium}>
          {activeRoutine.emoji} {activeRoutine.name}
        </Text>
        <Pressable style={styles.addButton} onPress={() => setShowAddExercise(true)}>
          <Plus size={18} color={OrialColors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Overload alerts */}
        {overloadAlerts.length > 0 && (
          <View style={styles.section}>
            {overloadAlerts.map((alert) => (
              <GlassCard key={alert.exerciseId} style={styles.alertCard}>
                <TrendingUp size={16} color={OrialColors.success} />
                <View style={styles.alertBody}>
                  <Text style={[OrialTypography.bodyMedium, { color: OrialColors.success }]}>
                    Increase {alert.exerciseName}
                  </Text>
                  <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                    {alert.currentWeightKg} kg → {alert.nextWeightKg} kg
                  </Text>
                </View>
                <Pressable
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptOverload(alert)}
                >
                  <Check size={16} color={OrialColors.textPrimary} />
                </Pressable>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Start session button */}
        {!activeSession && (
          <View style={styles.section}>
            <Pressable style={styles.startSessionBtn} onPress={handleStartSession}>
              <Dumbbell size={20} color={OrialColors.textPrimary} />
              <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                Start Today's Session
              </Text>
            </Pressable>
          </View>
        )}

        {activeSession && (
          <GlassCard style={[styles.sessionBadge, { marginHorizontal: 16 }]}>
            <Check size={14} color={OrialColors.success} />
            <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>
              Session active — {sessionSets.length} sets logged
            </Text>
          </GlassCard>
        )}

        {/* Exercises */}
        <View style={styles.section}>
          {exercises.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                No exercises. Tap + to add.
              </Text>
            </GlassCard>
          ) : (
            exercises.map((ex) => {
              const isExpanded = expandedExercise === ex.id;
              const exSets = getExerciseSets(ex.id);
              const alert = overloadAlerts.find((a) => a.exerciseId === ex.id);

              return (
                <GlassCard key={ex.id} style={styles.exerciseCard}>
                  <Pressable
                    style={styles.exerciseHeader}
                    onPress={() => setExpandedExercise(isExpanded ? null : ex.id)}
                  >
                    <View style={styles.exerciseInfo}>
                      <Text style={OrialTypography.bodyMedium}>{ex.name}</Text>
                      <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                        {ex.targetSets}×{ex.targetRepsMin}–{ex.targetRepsMax} @ {ex.currentWeightKg} kg
                      </Text>
                    </View>
                    <View style={styles.exerciseMeta}>
                      {exSets.length > 0 && (
                        <View style={styles.setsBadge}>
                          <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>
                            {exSets.length}/{ex.targetSets}
                          </Text>
                        </View>
                      )}
                      {isExpanded ? (
                        <ChevronDown size={18} color={OrialColors.textMuted} />
                      ) : (
                        <ChevronRight size={18} color={OrialColors.textMuted} />
                      )}
                    </View>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.exerciseBody}>
                      {/* Previous sets */}
                      {exSets.length > 0 && (
                        <View style={styles.previousSets}>
                          {exSets.map((s) => (
                            <View key={s.id} style={styles.setRow}>
                              <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                                Set {s.setNumber}
                              </Text>
                              <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>
                                {s.reps} reps × {s.weightKg} kg
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Log set inputs */}
                      {activeSession && exSets.length < ex.targetSets && (
                        <View style={styles.logRow}>
                          <TextInput
                            style={[styles.miniInput, { flex: 1 }]}
                            placeholder="Reps"
                            placeholderTextColor={OrialColors.textMuted}
                            keyboardType="numeric"
                            value={logReps[ex.id] || ''}
                            onChangeText={(v) => setLogReps((p) => ({ ...p, [ex.id]: v }))}
                          />
                          <TextInput
                            style={[styles.miniInput, { flex: 1 }]}
                            placeholder={`${ex.currentWeightKg} kg`}
                            placeholderTextColor={OrialColors.textMuted}
                            keyboardType="numeric"
                            value={logWeight[ex.id] || ''}
                            onChangeText={(v) => setLogWeight((p) => ({ ...p, [ex.id]: v }))}
                          />
                          <Pressable style={styles.logBtn} onPress={() => handleLogSet(ex)}>
                            <Check size={16} color={OrialColors.textPrimary} />
                          </Pressable>
                        </View>
                      )}

                      {/* All sets done */}
                      {activeSession && exSets.length >= ex.targetSets && (
                        <Text style={[OrialTypography.caption, { color: OrialColors.success, marginTop: 8 }]}>
                          All sets complete
                        </Text>
                      )}
                    </View>
                  )}
                </GlassCard>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Exercise Modal */}
      <Modal visible={showAddExercise} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Exercise</Text>

            <TextInput
              style={styles.input}
              placeholder="Exercise name"
              placeholderTextColor={OrialColors.textMuted}
              value={newExName}
              onChangeText={setNewExName}
              autoFocus
            />

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, styles.fieldLabel]}>Sets</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newExSets} onChangeText={setNewExSets} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, styles.fieldLabel]}>Reps min</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newExRepsMin} onChangeText={setNewExRepsMin} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, styles.fieldLabel]}>Reps max</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newExRepsMax} onChangeText={setNewExRepsMax} />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, styles.fieldLabel]}>Starting weight (kg)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newExWeight} onChangeText={setNewExWeight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, styles.fieldLabel]}>Increment (kg)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={newExIncrement} onChangeText={setNewExIncrement} />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddExercise(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleCreateExercise}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  addButton: { padding: 8, backgroundColor: OrialColors.violet, borderRadius: 12 },
  section: { padding: 16, paddingTop: 8, gap: 10 },
  emptyCard: { alignItems: 'center', padding: 32, gap: 12 },
  emptyText: { color: OrialColors.textMuted, textAlign: 'center' },
  routineCard: { padding: 14 },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routineEmoji: { fontSize: 28 },
  routineInfo: { flex: 1 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderColor: OrialColors.success + '40', borderWidth: 1 },
  alertBody: { flex: 1 },
  acceptBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: OrialColors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  startSessionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 14,
    backgroundColor: OrialColors.violet,
    borderRadius: 14,
  },
  sessionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, padding: 10,
  },
  exerciseCard: { padding: 0, overflow: 'hidden' },
  exerciseHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  exerciseInfo: { flex: 1 },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setsBadge: {
    paddingHorizontal: 8, paddingVertical: 2,
    backgroundColor: OrialColors.success + '20',
    borderRadius: 8,
  },
  exerciseBody: { paddingHorizontal: 14, paddingBottom: 14 },
  previousSets: { gap: 4, marginBottom: 10 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between' },
  logRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  miniInput: {
    backgroundColor: OrialColors.surface,
    borderRadius: 8, padding: 8,
    ...OrialTypography.caption,
    color: OrialColors.textPrimary,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  logBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center', alignItems: 'center',
  },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { margin: 16, padding: 20 },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 10, padding: 12,
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    marginBottom: 12,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: OrialColors.textMuted, marginBottom: 4 },
  daysRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dayChip: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: OrialColors.surface,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  dayChipActive: { backgroundColor: OrialColors.violet, borderColor: OrialColors.violet },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: OrialColors.violet, borderRadius: 10,
  },
});
