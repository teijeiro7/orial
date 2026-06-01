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
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dumbbell, ChevronRight, Clock, Heart, Zap, Flame, Activity } from 'lucide-react-native';
import { gymService } from '../../src/services/gymService';
import type { Zones } from '../../src/services/gymService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { StrainBar } from '../../src/components/gym/StrainBar';
import { ZoneBadge } from '../../src/components/gym/ZoneBadge';
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

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function TodayCard({ session }: { session: SessionSummary | null }) {
  const router = useRouter();
  const zones = session ? parseZones(session.zonesJson) : null;

  const strainPct = session?.strainScore != null ? Math.min(100, (session.strainScore / 21) * 100) : 0;
  const strainColor = (session?.strainScore ?? 0) >= 15
    ? OrialColors.error
    : (session?.strainScore ?? 0) >= 10
    ? OrialColors.warning
    : OrialColors.success;

  return (
    <Pressable
      style={todayStyles.card}
      onPress={session ? () => {} : undefined}
    >
      <View style={todayStyles.header}>
        <View style={todayStyles.titleRow}>
          <View style={[todayStyles.iconWrap, { backgroundColor: strainColor + '20' }]}>
            <Flame size={18} color={strainColor} strokeWidth={2} />
          </View>
          <View>
            <Text style={todayStyles.title}>
              {session ? session.routineName : 'Sin sesión hoy'}
            </Text>
            <Text style={todayStyles.subtitle}>
              {session
                ? format(new Date(session.date), 'HH:mm', { locale: es })
                : 'Esperando datos de WHOOP'}
            </Text>
          </View>
        </View>

        {session?.strainScore != null && (
          <View style={[todayStyles.strainRing, { borderColor: strainColor }]}>
            <Text style={[todayStyles.strainValue, { color: strainColor }]}>
              {session.strainScore.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {session ? (
        <>
          <View style={todayStyles.statsGrid}>
            <View style={todayStyles.statBox}>
              <Clock size={14} color={OrialColors.textMuted} strokeWidth={1.5} />
              <Text style={todayStyles.statValue}>
                {session.durationMin ? `${session.durationMin}m` : '—'}
              </Text>
              <Text style={todayStyles.statLabel}>Duración</Text>
            </View>
            <View style={todayStyles.statBox}>
              <Zap size={14} color={OrialColors.textMuted} strokeWidth={1.5} />
              <Text style={todayStyles.statValue}>
                {session.kilojoule ? Math.round(session.kilojoule).toLocaleString('es') : '—'}
              </Text>
              <Text style={todayStyles.statLabel}>kJ</Text>
            </View>
            <View style={todayStyles.statBox}>
              <Heart size={14} color={OrialColors.textMuted} strokeWidth={1.5} />
              <Text style={todayStyles.statValue}>
                {session.avgHeartRate ? Math.round(session.avgHeartRate) : '—'}
              </Text>
              <Text style={todayStyles.statLabel}>bpm avg</Text>
            </View>
          </View>

          {zones && (
            <View style={todayStyles.zonesContainer}>
              <Text style={todayStyles.zonesLabel}>ZONAS DE ESFUERZO</Text>
              <View style={todayStyles.zonesRow}>
                {([1, 2, 3, 4, 5] as const).map(z => {
                  const pct = zones[`z${z}` as keyof Zones] as number;
                  if (!pct || pct === 0) return null;
                  return <ZoneBadge key={z} zone={z} pct={Math.round(pct)} />;
                })}
              </View>
            </View>
          )}

          <View style={todayStyles.strainBarContainer}>
            <View style={todayStyles.strainBarTrack}>
              <View style={[todayStyles.strainBarFill, { width: `${strainPct}%`, backgroundColor: strainColor }]} />
            </View>
            <Text style={todayStyles.strainBarLabel}>Strain {session.strainScore?.toFixed(1) ?? '—'} / 21</Text>
          </View>
        </>
      ) : (
        <View style={todayStyles.emptyState}>
          <Activity size={32} color={OrialColors.textMuted} strokeWidth={1} />
          <Text style={todayStyles.emptyText}>
            Tu entrenamiento de hoy aparecerá aquí cuando Hermes lo procese
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function GymScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const todaySession = sessions.find(s => isToday(new Date(s.date)));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Gym</Text>
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
        <Text style={styles.screenTitle}>Gym</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OrialColors.textMuted} />
        }
      >
        <View style={{ marginHorizontal: 20 }}>
          <TodayCard session={todaySession ?? null} />
        </View>

        <View style={styles.navButtons}>
          <Pressable style={styles.navButton} onPress={() => router.push('/gym/sessions')}>
            <View style={styles.navIconWrap}>
              <Activity size={20} color={OrialColors.cyan} strokeWidth={1.5} />
            </View>
            <View style={styles.navTextGroup}>
              <Text style={styles.navTitle}>Sesiones</Text>
              <Text style={styles.navSubtitle}>Historial y estadísticas</Text>
            </View>
            <ChevronRight size={18} color={OrialColors.textMuted} strokeWidth={1.5} />
          </Pressable>

          <Pressable style={styles.navButton} onPress={() => router.push('/gym/routines')}>
            <View style={[styles.navIconWrap, { backgroundColor: OrialColors.violet + '20' }]}>
              <Dumbbell size={20} color={OrialColors.violetLight} strokeWidth={1.5} />
            </View>
            <View style={styles.navTextGroup}>
              <Text style={styles.navTitle}>Rutinas</Text>
              <Text style={styles.navSubtitle}>Ejercicios por rutina</Text>
            </View>
            <ChevronRight size={18} color={OrialColors.textMuted} strokeWidth={1.5} />
          </Pressable>
        </View>
      </ScrollView>
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
  screenTitle: {
    ...OrialTypography.headingMedium,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  sectionLabel: {
    ...OrialTypography.caption,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: OrialColors.textMuted,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...OrialTypography.bodySmall, color: OrialColors.textMuted },
  navButtons: {
    marginTop: 24,
    marginHorizontal: 20,
    gap: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OrialColors.darkBlue,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OrialColors.border,
    padding: 16,
    gap: 14,
  },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: OrialColors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTextGroup: { flex: 1 },
  navTitle: {
    ...OrialTypography.bodyMedium,
    fontSize: 15,
    color: OrialColors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  navSubtitle: {
    ...OrialTypography.caption,
    fontSize: 11,
    color: OrialColors.textMuted,
  },
});

const todayStyles = StyleSheet.create({
  card: {
    backgroundColor: OrialColors.darkBlue,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: OrialColors.border,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...OrialTypography.headingSmall,
    fontSize: 17,
    color: OrialColors.textPrimary,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    ...OrialTypography.caption,
    fontSize: 11,
    color: OrialColors.textMuted,
    marginTop: 2,
  },
  strainRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: OrialColors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strainValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 0,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  statValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginTop: 6,
  },
  statLabel: {
    ...OrialTypography.caption,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: OrialColors.textMuted,
    marginTop: 2,
  },
  zonesContainer: {
    marginBottom: 16,
  },
  zonesLabel: {
    ...OrialTypography.caption,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: OrialColors.textMuted,
    marginBottom: 8,
  },
  zonesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  strainBarContainer: {
    marginTop: 4,
  },
  strainBarTrack: {
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  strainBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  strainBarLabel: {
    ...OrialTypography.caption,
    fontSize: 10,
    color: OrialColors.textMuted,
    marginTop: 6,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  emptyText: {
    ...OrialTypography.bodySmall,
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
});