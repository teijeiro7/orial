import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Dumbbell, ChevronRight, TrendingUp, Calendar, Trash2 } from 'lucide-react-native';
import { gymService } from '../../src/services/gymService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { GymRoutine, GymExercise } from '../../drizzle/schema';

type RoutineWithStats = GymRoutine & {
  exerciseCount: number;
  sessionCount: number;
  lastSessionDate: string | null;
  exercises: GymExercise[];
};

function ProgressChart({ exerciseName, routineId }: { exerciseName: string; routineId: string }) {
  const [progress, setProgress] = useState<Array<{ date: string; avgWeight: number; totalReps: number }>>([]);

  useEffect(() => {
    gymService.getRoutineExerciseProgress(routineId, exerciseName).then(p => {
      setProgress(p.slice(-5));
    });
  }, [routineId, exerciseName]);

  if (progress.length < 2) return null;

  const maxWeight = Math.max(...progress.map(p => p.avgWeight));
  const minWeight = Math.min(...progress.map(p => p.avgWeight));
  const range = maxWeight - minWeight || 1;

  return (
    <View style={chartStyles.container}>
      <View style={chartStyles.bars}>
        {progress.map((p, i) => {
          const height = 24 + ((p.avgWeight - minWeight) / range) * 32;
          const isLast = i === progress.length - 1;
          return (
            <View key={p.date} style={chartStyles.barWrap}>
              <View style={[chartStyles.bar, { height, backgroundColor: isLast ? OrialColors.success : OrialColors.textMuted + '40' }]} />
              <Text style={chartStyles.barLabel}>{format(new Date(p.date), 'd/MM')}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function RoutineCard({ routine, onExpand, onDelete }: {
  routine: RoutineWithStats;
  onExpand: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={cardStyles.card}>
      <Pressable style={cardStyles.mainRow} onPress={onExpand}>
        <View style={cardStyles.iconWrap}>
          <Dumbbell size={18} color={OrialColors.violetLight} strokeWidth={1.5} />
        </View>
        <View style={cardStyles.info}>
          <Text style={cardStyles.name}>{routine.name}</Text>
          <View style={cardStyles.meta}>
            <Text style={cardStyles.metaText}>
              {routine.exerciseCount} {routine.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
            </Text>
            <View style={cardStyles.dot} />
            <Text style={cardStyles.metaText}>
              {routine.sessionCount} {routine.sessionCount === 1 ? 'sesión' : 'sesiones'}
            </Text>
          </View>
        </View>
        <View style={cardStyles.right}>
          {routine.lastSessionDate && (
            <Text style={cardStyles.lastDate}>
              {format(new Date(routine.lastSessionDate), 'd MMM', { locale: es })}
            </Text>
          )}
          <ChevronRight size={16} color={OrialColors.textMuted} strokeWidth={1.5} />
        </View>
      </Pressable>
    </View>
  );
}

function RoutineDetail({ routine, onClose }: { routine: RoutineWithStats; onClose: () => void }) {
  const [progress, setProgress] = useState<Record<string, Array<{ date: string; avgWeight: number }>>>({});

  useEffect(() => {
    const loadProgress = async () => {
      const progs: Record<string, Array<{ date: string; avgWeight: number }>> = {};
      for (const ex of routine.exercises) {
        const p = await gymService.getRoutineExerciseProgress(routine.id, ex.name);
        progs[ex.name] = p.slice(-4).map(item => ({ date: item.date, avgWeight: item.avgWeight }));
      }
      setProgress(progs);
    };
    loadProgress();
  }, [routine.id]);

  return (
    <View style={detailStyles.overlay}>
      <Pressable style={detailStyles.backdrop} onPress={onClose} />
      <View style={detailStyles.sheet}>
        <View style={detailStyles.handle} />
        <View style={detailStyles.header}>
          <View style={detailStyles.titleRow}>
            <View style={detailStyles.iconWrap}>
              <Dumbbell size={20} color={OrialColors.violetLight} strokeWidth={1.5} />
            </View>
            <Text style={detailStyles.title}>{routine.name}</Text>
          </View>
          <View style={detailStyles.stats}>
            <View style={detailStyles.statItem}>
              <Text style={detailStyles.statValue}>{routine.exerciseCount}</Text>
              <Text style={detailStyles.statLabel}>ejercicios</Text>
            </View>
            <View style={detailStyles.statItem}>
              <Text style={detailStyles.statValue}>{routine.sessionCount}</Text>
              <Text style={detailStyles.statLabel}>sesiones</Text>
            </View>
          </View>
        </View>

        <ScrollView style={detailStyles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={detailStyles.sectionTitle}>EJERCICIOS</Text>
          {routine.exercises.map(ex => (
            <View key={ex.id} style={detailStyles.exerciseItem}>
              <View style={detailStyles.exerciseHeader}>
                <Text style={detailStyles.exerciseName}>{ex.name}</Text>
                <View style={detailStyles.exerciseMeta}>
                  <TrendingUp size={12} color={OrialColors.success} strokeWidth={2} />
                  <Text style={detailStyles.exerciseWeight}>
                    {ex.currentWeightKg} kg actual
                  </Text>
                </View>
              </View>

              {progress[ex.name] && progress[ex.name].length >= 2 && (
                <View style={detailStyles.chartContainer}>
                  <View style={detailStyles.chartBars}>
                    {progress[ex.name].map((p, i) => {
                      const maxW = Math.max(...progress[ex.name].map(x => x.avgWeight));
                      const minW = Math.min(...progress[ex.name].map(x => x.avgWeight));
                      const range = maxW - minW || 1;
                      const height = 20 + ((p.avgWeight - minW) / range) * 28;
                      return (
                        <View key={p.date} style={detailStyles.chartBarWrap}>
                          <View style={[detailStyles.chartBar, { height, backgroundColor: i === progress[ex.name].length - 1 ? OrialColors.success : OrialColors.textMuted + '50' }]} />
                          <Text style={detailStyles.chartLabel}>{format(new Date(p.date), 'd/MM')}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <Pressable style={detailStyles.deleteBtn} onPress={onClose}>
          <Trash2 size={14} color={OrialColors.error} strokeWidth={1.5} />
          <Text style={detailStyles.deleteBtnText}>Eliminar rutina</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RoutinesScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineWithStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailRoutine, setDetailRoutine] = useState<RoutineWithStats | null>(null);

  const loadData = useCallback(async () => {
    const r = await gymService.getRoutines();
    const withStats: RoutineWithStats[] = [];

    for (const routine of r) {
      const exercises = await gymService.getExercisesForRoutine(routine.id);
      const sessions = await gymService.getSessionsForDateRange('2020-01-01', '2099-12-31');
      const routineSessions = sessions.filter(s => s.routineId === routine.id);
      const lastSession = routineSessions[0];

      withStats.push({
        ...routine,
        exerciseCount: exercises.length,
        sessionCount: routineSessions.length,
        lastSessionDate: lastSession?.date ?? null,
        exercises,
      });
    }

    setRoutines(withStats);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDeleteRoutine = async (routine: RoutineWithStats) => {
    await gymService.deleteRoutine(routine.id);
    setDetailRoutine(null);
    loadData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={OrialColors.textMuted} strokeWidth={1.5} />
          </Pressable>
          <Text style={styles.screenTitle}>Rutinas</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={OrialColors.textMuted} strokeWidth={1.5} />
        </Pressable>
        <Text style={styles.screenTitle}>Rutinas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OrialColors.textMuted} />
        }
      >
        <Text style={styles.countLabel}>
          {routines.length} {routines.length === 1 ? 'rutina' : 'rutinas'}
        </Text>

        {routines.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={OrialColors.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>Sin rutinas</Text>
            <Text style={styles.emptySubtitle}>
              Cuando Hermes procese un entrenamiento creará las rutinas automáticamente
            </Text>
          </View>
        ) : (
          <View style={styles.routinesList}>
            {routines.map((routine, idx) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onExpand={() => setDetailRoutine(routine)}
                onDelete={() => handleDeleteRoutine(routine)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {detailRoutine && (
        <RoutineDetail
          routine={detailRoutine}
          onClose={() => setDetailRoutine(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  screenTitle: { ...OrialTypography.headingMedium, fontSize: 18, letterSpacing: -0.3 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...OrialTypography.bodySmall, color: OrialColors.textMuted },
  countLabel: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.textMuted, marginBottom: 16, letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { ...OrialTypography.bodyMedium, color: OrialColors.textPrimary, fontWeight: '500' },
  emptySubtitle: { ...OrialTypography.bodySmall, fontSize: 13, color: OrialColors.textMuted, textAlign: 'center', maxWidth: 260 },
  routinesList: { gap: 12 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: OrialColors.darkBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OrialColors.border,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: OrialColors.violet + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  name: { ...OrialTypography.bodyMedium, fontSize: 16, color: OrialColors.textPrimary, fontWeight: '600', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: OrialColors.textMuted },
  right: { alignItems: 'flex-end', gap: 4 },
  lastDate: { ...OrialTypography.caption, fontSize: 10, color: OrialColors.textMuted },
});

const detailStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: OrialColors.darkBlue,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 48,
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: OrialColors.border, alignSelf: 'center', marginBottom: 20 },
  header: { marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: OrialColors.violet + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...OrialTypography.headingMedium, fontSize: 20, letterSpacing: -0.3 },
  stats: { flexDirection: 'row', gap: 20 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: 'Inter-SemiBold', fontSize: 18, fontWeight: '600', color: OrialColors.textPrimary, fontVariant: ['tabular-nums'] },
  statLabel: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.textMuted },
  scroll: { maxHeight: 400 },
  sectionTitle: { ...OrialTypography.caption, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: OrialColors.textMuted, marginBottom: 12 },
  exerciseItem: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  exerciseName: { ...OrialTypography.bodyMedium, fontSize: 15, color: OrialColors.textPrimary, fontWeight: '600' },
  exerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exerciseWeight: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.success },
  chartContainer: { marginTop: 4 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 56 },
  chartBarWrap: { flex: 1, alignItems: 'center' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 8 },
  chartLabel: { ...OrialTypography.caption, fontSize: 8, color: OrialColors.textMuted, marginTop: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: OrialColors.border,
  },
  deleteBtnText: { ...OrialTypography.bodyMedium, fontSize: 14, color: OrialColors.error },
});

const chartStyles = StyleSheet.create({
  container: { marginTop: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56 },
  barWrap: { flex: 1, alignItems: 'center' },
  bar: { width: '100%', borderRadius: 3, minHeight: 6 },
  barLabel: { ...OrialTypography.caption, fontSize: 8, color: OrialColors.textMuted, marginTop: 4 },
});