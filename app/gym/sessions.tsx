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
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ChevronRight, Clock, Dumbbell, Flame } from 'lucide-react-native';
import { gymService } from '../../src/services/gymService';
import type { Zones } from '../../src/services/gymService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { StrainBar } from '../../src/components/gym/StrainBar';
import type { GymSession } from '../../drizzle/schema';

type SessionSummary = GymSession & {
  routineName: string;
  exerciseCount: number;
  totalVolume: number;
};

function parseZones(zonesJson: string | null): Zones | null {
  if (!zonesJson) return null;
  try { return JSON.parse(zonesJson) as Zones; }
  catch { return null; }
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoy';
  if (isYesterday(d)) return 'Ayer';
  return format(d, 'd MMM', { locale: es });
}

function SessionCard({ session, onPress }: { session: SessionSummary; onPress: () => void }) {
  const zones = parseZones(session.zonesJson);
  const strainColor = (session.strainScore ?? 0) >= 15
    ? OrialColors.error
    : (session.strainScore ?? 0) >= 10
    ? OrialColors.warning
    : OrialColors.success;

  return (
    <Pressable style={cardStyles.card} onPress={onPress}>
      <View style={cardStyles.header}>
        <View style={cardStyles.dateGroup}>
          <Text style={cardStyles.dateLabel}>{formatDateLabel(session.date)}</Text>
          <Text style={cardStyles.yearLabel}>{format(new Date(session.date), 'yyyy')}</Text>
        </View>

        {session.strainScore != null && (
          <View style={[cardStyles.strainBadge, { backgroundColor: strainColor + '20' }]}>
            <Flame size={12} color={strainColor} strokeWidth={2} />
            <Text style={[cardStyles.strainText, { color: strainColor }]}>
              {session.strainScore.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <Text style={cardStyles.routineName}>{session.routineName}</Text>

      <View style={cardStyles.statsRow}>
        <View style={cardStyles.statPill}>
          <Dumbbell size={11} color={OrialColors.textMuted} strokeWidth={1.5} />
          <Text style={cardStyles.statPillText}>{session.exerciseCount} ejer</Text>
        </View>
        <View style={cardStyles.statPill}>
          <Clock size={11} color={OrialColors.textMuted} strokeWidth={1.5} />
          <Text style={cardStyles.statPillText}>
            {session.durationMin ? `${session.durationMin}m` : '—'}
          </Text>
        </View>
        <Text style={cardStyles.volumeText}>
          {Math.round(session.totalVolume).toLocaleString('es')} kg
        </Text>
      </View>

      {zones && (
        <View style={cardStyles.zonesRow}>
          {([1, 2, 3, 4, 5] as const).map(z => {
            const pct = zones[`z${z}` as keyof Zones] as number;
            if (!pct || pct === 0) return null;
            return (
              <View key={z} style={[cardStyles.zoneDot, { backgroundColor: getZoneColor(z) }]} />
            );
          })}
        </View>
      )}

      <View style={cardStyles.footer}>
        <Text style={cardStyles.footerText}>Ver detalle</Text>
        <ChevronRight size={14} color={OrialColors.textMuted} strokeWidth={1.5} />
      </View>
    </Pressable>
  );
}

function getZoneColor(zone: number): string {
  const colors = ['#64748B', '#22C55E', '#F59E0B', '#EF4444', '#DC2626'];
  return colors[zone - 1];
}

function SessionDetail({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof gymService.getSessionWithExercises>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gymService.getSessionWithExercises(sessionId).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [sessionId]);

  return (
    <View style={detailStyles.overlay}>
      <Pressable style={detailStyles.backdrop} onPress={onClose} />
      <View style={detailStyles.sheet}>
        <View style={detailStyles.handle} />

        {loading ? (
          <View style={detailStyles.loading}>
            <Text style={detailStyles.loadingText}>Cargando...</Text>
          </View>
        ) : detail ? (
          <>
            <View style={detailStyles.header}>
              <Text style={detailStyles.title}>{detail.routineName}</Text>
              <Text style={detailStyles.subtitle}>
                {format(new Date(detail.date), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </Text>
            </View>

            {detail.strainScore != null && (
              <View style={detailStyles.heroStats}>
                <View style={detailStyles.heroStat}>
                  <Text style={detailStyles.heroValue}>{detail.strainScore.toFixed(1)}</Text>
                  <Text style={detailStyles.heroLabel}>STRAIN</Text>
                  <StrainBar strain={detail.strainScore} />
                </View>
                <View style={detailStyles.heroStat}>
                  <Text style={detailStyles.heroValue}>
                    {detail.kilojoule ? Math.round(detail.kilojoule).toLocaleString('es') : '—'}
                  </Text>
                  <Text style={detailStyles.heroLabel}>kJ</Text>
                </View>
                <View style={detailStyles.heroStat}>
                  <Text style={detailStyles.heroValue}>
                    {detail.avgHeartRate ? Math.round(detail.avgHeartRate) : '—'}
                  </Text>
                  <Text style={detailStyles.heroLabel}>bpm avg</Text>
                </View>
                <View style={detailStyles.heroStat}>
                  <Text style={detailStyles.heroValue}>
                    {detail.durationMin ? `${detail.durationMin}m` : '—'}
                  </Text>
                  <Text style={detailStyles.heroLabel}>dur</Text>
                </View>
              </View>
            )}

            {detail.zonesJson && (
              <View style={detailStyles.zonesContainer}>
                <Text style={detailStyles.zonesTitle}>ZONAS DE ESFUERZO</Text>
                <View style={detailStyles.zonesGrid}>
                  {([1, 2, 3, 4, 5] as const).map(z => {
                    const zones = parseZones(detail.zonesJson);
                    if (!zones) return null;
                    const pct = zones[`z${z}` as keyof Zones] as number;
                    if (!pct || pct === 0) return null;
                    return (
                      <View key={z} style={detailStyles.zoneItem}>
                        <View style={[detailStyles.zoneCircle, { backgroundColor: getZoneColor(z) + '30', borderColor: getZoneColor(z) }]}>
                          <Text style={[detailStyles.zoneNum, { color: getZoneColor(z) }]}>Z{z}</Text>
                        </View>
                        <Text style={detailStyles.zonePct}>{Math.round(pct)}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            <ScrollView style={detailStyles.exercisesScroll} showsVerticalScrollIndicator={false}>
              <Text style={detailStyles.exercisesTitle}>EJERCICIOS</Text>
              {detail.exercises.map(({ exercise, sets }) => (
                <View key={exercise.id} style={detailStyles.exerciseCard}>
                  <Text style={detailStyles.exerciseName}>{exercise.name}</Text>
                  <View style={detailStyles.setsGrid}>
                    {sets.map(set => (
                      <View key={set.id} style={detailStyles.setItem}>
                        <Text style={detailStyles.setNum}>S{set.setNumber}</Text>
                        <Text style={detailStyles.setData}>{set.reps} × {set.weightKg} kg</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState<SessionSummary | null>(null);

  const loadData = useCallback(async () => {
    const s = await gymService.getAllSessionsWithRoutines();
    setSessions(s);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={OrialColors.textMuted} strokeWidth={1.5} />
          </Pressable>
          <Text style={styles.screenTitle}>Sesiones</Text>
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
        <Text style={styles.screenTitle}>Sesiones</Text>
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
          {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}
        </Text>

        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Dumbbell size={40} color={OrialColors.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>Sin sesiones</Text>
            <Text style={styles.emptySubtitle}>
              Cuando Hermes procese tu primer entrenamiento aparecerá aquí
            </Text>
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {sessions.map((session, idx) => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => setDetailSession(session)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {detailSession && (
        <SessionDetail
          sessionId={detailSession.id}
          onClose={() => setDetailSession(null)}
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
  sessionsList: { gap: 12 },
  headerSpacer: { height: 20 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: OrialColors.darkBlue,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OrialColors.border,
    padding: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  dateGroup: {},
  dateLabel: { ...OrialTypography.bodyMedium, fontSize: 15, color: OrialColors.textPrimary, fontWeight: '600' },
  yearLabel: { ...OrialTypography.caption, fontSize: 10, color: OrialColors.textMuted, marginTop: 1 },
  strainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  strainText: { fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  routineName: { ...OrialTypography.headingSmall, fontSize: 16, color: OrialColors.textPrimary, fontWeight: '600', letterSpacing: -0.2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: OrialColors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statPillText: { ...OrialTypography.caption, fontSize: 10, color: OrialColors.textMuted, fontVariant: ['tabular-nums'] },
  volumeText: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.textSecondary, fontVariant: ['tabular-nums'], marginLeft: 'auto' },
  zonesRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: OrialColors.border },
  footerText: { ...OrialTypography.caption, fontSize: 11, color: OrialColors.textMuted },
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
  loading: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { ...OrialTypography.bodySmall, color: OrialColors.textMuted },
  header: { marginBottom: 20 },
  title: { ...OrialTypography.headingMedium, fontSize: 22, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { ...OrialTypography.bodySmall, fontSize: 12, color: OrialColors.textMuted, textTransform: 'capitalize' },
  heroStats: { flexDirection: 'row', marginBottom: 20, gap: 0 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: { fontFamily: 'Inter-Bold', fontSize: 22, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  heroLabel: { ...OrialTypography.caption, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: OrialColors.textMuted, marginBottom: 8, marginTop: 4 },
  zonesContainer: { marginBottom: 20 },
  zonesTitle: { ...OrialTypography.caption, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: OrialColors.textMuted, marginBottom: 12 },
  zonesGrid: { flexDirection: 'row', gap: 8 },
  zoneItem: { alignItems: 'center', gap: 4 },
  zoneCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  zoneNum: { fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '600' },
  zonePct: { ...OrialTypography.caption, fontSize: 10, color: OrialColors.textMuted, fontVariant: ['tabular-nums'] },
  exercisesScroll: { maxHeight: 350 },
  exercisesTitle: { ...OrialTypography.caption, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: OrialColors.textMuted, marginBottom: 12 },
  exerciseCard: { backgroundColor: OrialColors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  exerciseName: { ...OrialTypography.bodyMedium, fontSize: 14, color: OrialColors.textPrimary, fontWeight: '600', marginBottom: 10 },
  setsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  setItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: OrialColors.darkBlue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  setNum: { ...OrialTypography.caption, fontSize: 10, color: OrialColors.textMuted, width: 20 },
  setData: { ...OrialTypography.bodySmall, fontSize: 12, color: OrialColors.textPrimary, fontVariant: ['tabular-nums'] },
});