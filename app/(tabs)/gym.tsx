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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  Dumbbell,
  ChevronRight,
  TrendingUp,
  Check,
  X,
  Camera,
  Images,
  Trophy,
} from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { GymSetRow } from '../../src/components/GymSetRow';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Ring } from '../../src/components/Ring';
import { Chip } from '../../src/components/Chip';
import { gymService } from '../../src/services/gymService';
import { gymCoachService } from '../../src/services/gymCoachService';
import type { ProgressionResult, SwapAlternative } from '../../src/services/gymCoachService';
import { progressPhotoService } from '../../src/services/progressPhotoService';
import type { ProgressPhoto } from '../../src/services/progressPhotoService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { GymRoutine, GymExercise, GymSession, GymSet } from '../../drizzle/schema';
import type { OverloadAlert } from '../../src/services/gymService';

type ScreenView = 'routines' | 'session';

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GymScreen() {
  const [view, setView] = useState<ScreenView>('routines');
  const [routines, setRoutines] = useState<GymRoutine[]>([]);
  const [routineMeta, setRoutineMeta] = useState<
    Record<string, { exerciseCount: number; lastSessionDaysAgo: number | null }>
  >({});
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

  // Gym Coach: swaps, auto-progression, progress photos
  const [swapFor, setSwapFor] = useState<GymExercise | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<SwapAlternative[]>([]);
  const [progressions, setProgressions] = useState<Record<string, ProgressionResult>>({});
  const [finishing, setFinishing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timeline, setTimeline] = useState<ProgressPhoto[]>([]);

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
    const metaEntries = await Promise.all(
      r.map(async (routine) => {
        const [routineExercises, lastSession] = await Promise.all([
          gymService.getExercisesForRoutine(routine.id),
          gymService.getLastSessionForRoutine(routine.id),
        ]);
        const lastSessionDaysAgo = lastSession
          ? Math.floor((Date.now() - new Date(lastSession.date).getTime()) / 86400000)
          : null;
        return [routine.id, { exerciseCount: routineExercises.length, lastSessionDaysAgo }] as const;
      }),
    );
    setRoutineMeta(Object.fromEntries(metaEntries));
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

  async function handleFinishSession() {
    if (!activeSession || !activeRoutine) return;
    setFinishing(true);
    try {
      const results = await gymCoachService.processCompletedSession(activeSession.id);
      const byExercise: Record<string, ProgressionResult> = {};
      for (const r of results) byExercise[r.exerciseId] = r;
      setProgressions(byExercise);
      await loadRoutineDetail(activeRoutine);
      if (results.length > 0) {
        setExpandedExercise(results[0].exerciseId);
        Alert.alert(
          '🎉 ¡Subida automática!',
          results.map((r) => `${r.exerciseName}: ${r.oldWeight} → ${r.newWeight} kg`).join('\n'),
        );
      } else {
        Alert.alert('Sesión guardada', 'Sigue así — aún no toca subir peso.');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo procesar la sesión');
    } finally {
      setFinishing(false);
    }
  }

  async function handleOpenSwap(exercise: GymExercise) {
    setSwapFor(exercise);
    setSwapAlternatives([]);
    try {
      const alternatives = await gymCoachService.getSwapAlternatives(exercise.id);
      setSwapAlternatives(alternatives);
    } catch {
      setSwapAlternatives([]);
    }
  }

  async function handleSelectSwap(alternative: SwapAlternative) {
    if (!swapFor || !activeRoutine) return;
    try {
      await gymCoachService.applySwap(swapFor.id, alternative.exerciseId);
      Alert.alert(
        '🔄 Ejercicio cambiado',
        `${swapFor.name} → ${alternative.name} a ${alternative.equivalentWeightKg} kg (misma intensidad)`,
      );
      setSwapFor(null);
      await loadRoutineDetail(activeRoutine);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cambiar el ejercicio');
    }
  }

  async function handleTakePhoto() {
    setPhotoBusy(true);
    try {
      const url = await progressPhotoService.takePhoto();
      if (url) Alert.alert('📸 Foto guardada', 'Tu foto de progreso se ha subido.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar la foto');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleOpenTimeline() {
    setShowTimeline(true);
    try {
      const photos = await progressPhotoService.getTimeline();
      setTimeline(photos);
    } catch (e) {
      setTimeline([]);
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cargar el timeline');
    }
  }

  function getExerciseSets(exerciseId: string) {
    return sessionSets.filter((s) => s.exerciseId === exerciseId);
  }

  // Session progress: completed sets vs. total sets targeted for this routine.
  const totalTargetSets = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const completedSets = sessionSets.length;
  const sessionProgressPct = totalTargetSets > 0 ? (completedSets / totalTargetSets) * 100 : 0;
  const nextExercise = exercises.find((ex) => getExerciseSets(ex.id).length < ex.targetSets) ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={OrialColors.violet} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  // ── Routine list view ────────────────────────────────────────────────────
  if (view === 'routines' || !activeRoutine) {
    const jsDay = new Date().getDay();
    const todayDow = jsDay === 0 ? 7 : jsDay;
    const todayRoutine = routines.find((r) => {
      const days: number[] = JSON.parse(r.days || '[]');
      return days.includes(todayDow);
    });
    const otherRoutines = todayRoutine ? routines.filter((r) => r.id !== todayRoutine.id) : routines;

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
            <>
              {todayRoutine && (
                <LinearGradient
                  colors={[OrialColors.surfaceElevated, OrialColors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.todayHero}
                >
                  <Text style={styles.todayKicker}>Hoy toca</Text>
                  <View style={styles.todayRow}>
                    <Dumbbell size={34} color={OrialColors.violetLight} />
                    <View style={styles.todayInfo}>
                      <Text style={styles.todayName}>{todayRoutine.name}</Text>
                      <Text style={styles.todayMeta}>
                        {routineMeta[todayRoutine.id]?.exerciseCount ?? 0} ejercicios
                        {routineMeta[todayRoutine.id]?.lastSessionDaysAgo != null
                          ? ` · último: hace ${routineMeta[todayRoutine.id]!.lastSessionDaysAgo} días`
                          : ''}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.todayCta}
                    onPress={() => { setActiveRoutine(todayRoutine); setView('session'); }}
                  >
                    <Dumbbell size={18} color={OrialColors.textPrimary} />
                    <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                      Empezar {todayRoutine.name}
                    </Text>
                  </Pressable>
                </LinearGradient>
              )}

              <SectionLabel label={todayRoutine ? 'Otras rutinas' : 'Rutinas'} />
              <View style={styles.section}>
                {otherRoutines.map((r) => {
                  const days: number[] = JSON.parse(r.days || '[]');
                  const meta = routineMeta[r.id];
                  return (
                    <Pressable key={r.id} onPress={() => { setActiveRoutine(r); setView('session'); }}>
                      <GlassCard style={styles.routineCard}>
                        <View style={styles.routineRow}>
                          <Text style={styles.routineEmoji}>{r.emoji}</Text>
                          <View style={styles.routineInfo}>
                            <Text style={OrialTypography.bodyMedium}>{r.name}</Text>
                            <View style={styles.freqDots}>
                              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                                <View
                                  key={d}
                                  style={[styles.freqDot, days.includes(d) && styles.freqDotOn]}
                                />
                              ))}
                            </View>
                            <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginTop: 3 }]}>
                              {meta?.lastSessionDaysAgo != null
                                ? `Último: hace ${meta.lastSessionDaysAgo} días`
                                : 'Sin sesiones aún'}
                            </Text>
                          </View>
                          <ChevronRight size={18} color={OrialColors.textMuted} />
                        </View>
                      </GlassCard>
                    </Pressable>
                  );
                })}
              </View>
            </>
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
                  <Chip
                    key={d}
                    label={DAY_LABELS[d].slice(0, 2)}
                    active={newRoutineDays.includes(d)}
                    onPress={() =>
                      setNewRoutineDays((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                      )
                    }
                  />
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
          <>
            <SectionLabel label="Más detalle" />
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
          </>
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
          <LinearGradient
            colors={[OrialColors.surfaceElevated, OrialColors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.focusCard}
          >
            <Ring pct={sessionProgressPct} size={76} strokeWidth={7} color={OrialColors.violetLight}>
              <Text style={styles.focusRingValue}>
                {completedSets}/{totalTargetSets}
              </Text>
              <Text style={styles.focusRingUnit}>SETS</Text>
            </Ring>
            <View style={styles.focusBody}>
              <Text style={styles.focusKicker}>{nextExercise ? 'Siguiente' : 'Sesión'}</Text>
              <Text style={[OrialTypography.bodyMedium, styles.focusTitle]}>
                {nextExercise
                  ? `${nextExercise.name} · Set ${getExerciseSets(nextExercise.id).length + 1} de ${nextExercise.targetSets}`
                  : 'Todos los sets completados'}
              </Text>
              {nextExercise && (
                <Pressable
                  style={styles.focusAction}
                  onPress={() => setExpandedExercise(nextExercise.id)}
                >
                  <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>
                    Registrar set
                  </Text>
                  <ChevronRight size={14} color={OrialColors.textPrimary} />
                </Pressable>
              )}
            </View>
          </LinearGradient>
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
            exercises.map((ex) => (
              <GymSetRow
                key={ex.id}
                exercise={ex}
                sets={getExerciseSets(ex.id)}
                isExpanded={expandedExercise === ex.id}
                isSessionActive={!!activeSession}
                repsValue={logReps[ex.id] || ''}
                weightValue={logWeight[ex.id] || ''}
                progression={progressions[ex.id] ?? null}
                onToggle={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                onChangeReps={(v) => setLogReps((p) => ({ ...p, [ex.id]: v }))}
                onChangeWeight={(v) => setLogWeight((p) => ({ ...p, [ex.id]: v }))}
                onLogSet={() => handleLogSet(ex)}
                onSwap={() => handleOpenSwap(ex)}
              />
            ))
          )}
        </View>

        {/* Finish session → auto-progression */}
        {activeSession && (
          <View style={styles.section}>
            <Pressable
              style={styles.finishSessionBtn}
              onPress={handleFinishSession}
              disabled={finishing}
            >
              {finishing ? (
                <ActivityIndicator color={OrialColors.textPrimary} />
              ) : (
                <>
                  <Trophy size={18} color={OrialColors.textPrimary} />
                  <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                    Finalizar sesión
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Progress photos */}
        <SectionLabel label="Fotos de progreso" />
        <View style={styles.section}>
          <View style={styles.photoRow}>
            <Pressable style={styles.photoBtn} onPress={handleTakePhoto} disabled={photoBusy}>
              {photoBusy ? (
                <ActivityIndicator color={OrialColors.textPrimary} />
              ) : (
                <>
                  <Camera size={18} color={OrialColors.textPrimary} />
                  <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>
                    Tomar foto
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.photoBtnOutline} onPress={handleOpenTimeline}>
              <Images size={18} color={OrialColors.cyan} />
              <Text style={[OrialTypography.caption, { color: OrialColors.cyan }]}>Ver progreso</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Swap Modal */}
      <Modal visible={!!swapFor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 4 }]}>
              🔄 Cambiar ejercicio
            </Text>
            <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginBottom: 16 }]}>
              {swapFor?.name} → alternativas con peso equivalente
            </Text>

            {swapAlternatives.length === 0 ? (
              <Text style={[OrialTypography.bodyMedium, styles.emptyText, { paddingVertical: 16 }]}>
                No hay alternativas en este grupo.
              </Text>
            ) : (
              swapAlternatives.map((alt) => (
                <Pressable
                  key={alt.exerciseId}
                  style={styles.swapOption}
                  onPress={() => handleSelectSwap(alt)}
                >
                  <Text style={OrialTypography.bodyMedium}>{alt.name}</Text>
                  <Text style={[OrialTypography.caption, { color: OrialColors.cyan }]}>
                    {alt.equivalentWeightKg} kg
                  </Text>
                </Pressable>
              ))
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setSwapFor(null)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Progress Photo Timeline Modal */}
      <Modal visible={showTimeline} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>
              🖼️ Progreso (antes / después)
            </Text>
            {timeline.length === 0 ? (
              <Text style={[OrialTypography.bodyMedium, styles.emptyText, { paddingVertical: 16 }]}>
                Aún no hay fotos. Toma tu primera foto de progreso.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.timelineRow}>
                  {timeline.map((photo) => (
                    <View key={photo.date} style={styles.timelineItem}>
                      <Image source={{ uri: photo.uri }} style={styles.timelineImage} />
                      <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                        {photo.date}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowTimeline(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

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
  todayHero: {
    marginHorizontal: 16, marginTop: 14, padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: OrialColors.borderStrong,
    gap: 12,
  },
  todayKicker: {
    fontSize: 9, letterSpacing: 1.4, color: OrialColors.violetLight,
    textTransform: 'uppercase', fontWeight: '600',
  },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todayInfo: { flex: 1, minWidth: 0 },
  todayName: { fontSize: 19, fontWeight: '700', color: OrialColors.textPrimary },
  todayMeta: { fontSize: 12, color: OrialColors.textMuted, marginTop: 2 },
  todayCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14,
    backgroundColor: OrialColors.violet, borderRadius: 12,
  },
  routineCard: { padding: 14 },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routineEmoji: { fontSize: 28 },
  routineInfo: { flex: 1 },
  freqDots: { flexDirection: 'row', gap: 3, marginTop: 5 },
  freqDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: OrialColors.borderStrong },
  freqDotOn: { backgroundColor: OrialColors.violetLight },
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
  focusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: 16, marginBottom: 8, padding: 18,
    borderRadius: 16, borderWidth: 1, borderColor: OrialColors.borderStrong,
  },
  focusRingValue: { fontSize: 20, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.5 },
  focusRingUnit: { fontSize: 8, color: OrialColors.textMuted, letterSpacing: 1, marginTop: 2 },
  focusBody: { flex: 1, minWidth: 0 },
  focusKicker: {
    fontSize: 9, letterSpacing: 1.4, color: OrialColors.textMuted,
    textTransform: 'uppercase', fontWeight: '500', marginBottom: 4,
  },
  focusTitle: { color: OrialColors.textPrimary, marginBottom: 10 },
  focusAction: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    backgroundColor: OrialColors.violet, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14,
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
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: OrialColors.violet, borderRadius: 10,
  },
  // Finish session + progress photos
  finishSessionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 14,
    backgroundColor: OrialColors.success,
    borderRadius: 14,
  },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12,
    backgroundColor: OrialColors.violet, borderRadius: 12,
  },
  photoBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, borderColor: OrialColors.cyan + '55',
  },
  swapOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, marginBottom: 8,
    backgroundColor: OrialColors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  timelineRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  timelineItem: { alignItems: 'center', gap: 6 },
  timelineImage: {
    width: 140, height: 186, borderRadius: 12,
    backgroundColor: OrialColors.surface,
  },
});
