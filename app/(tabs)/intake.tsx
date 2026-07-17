import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Flame, Coffee, Pill, ChevronRight, Check, AlertTriangle } from 'lucide-react-native';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { Ring } from '@/src/components/Ring';
import { AreaChart } from '@/src/components/AreaChart';
import { OrialColors } from '@/src/utils/colors';
import { nutritionService } from '@/src/services/nutritionService';
import { caffeineService } from '@/src/services/caffeineService';
import { supplementService } from '@/src/services/supplementService';
import type { NutritionLog, Supplement, SupplementLog } from '../../drizzle/schema';
import type { ActiveCaffeine, SleepInterferenceCheck } from '@/src/services/caffeineService';
import { todayDateString } from '@/src/utils/date';

type CaffeineTimelinePoint = { atMs: number; mg: number };

const CALORIE_GOAL = 2100;
// Matches the GOALS convention already established in app/(tabs)/macros.tsx —
// not fabricated for this screen, just reused as the same real threshold.
const MACRO_GOALS = { protein: 160, carbs: 220, fat: 70 };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Compact sparkline scale for the hub card — smaller than the dedicated
// Caffeine screen's chart (CHART_HEIGHT 100), since this is one of three
// stacked modules rather than the full-screen focus.
const SPARKLINE_HEIGHT = 44;
// Screen margin (16px x2) + GlassCard padding (20px x2).
const SPARKLINE_WIDTH = SCREEN_WIDTH - 72;

type SupplementLogItem = SupplementLog & { supplement: Supplement };

export default function IntakeScreen() {
  const router = useRouter();
  const [nutritionData, setNutritionData] = useState<NutritionLog | null>(null);
  const [activeCaffeine, setActiveCaffeine] = useState<ActiveCaffeine | null>(null);
  const [sleepCheck, setSleepCheck] = useState<SleepInterferenceCheck | null>(null);
  const [caffeineTimeline, setCaffeineTimeline] = useState<CaffeineTimelinePoint[]>([]);
  const [supplementItems, setSupplementItems] = useState<SupplementLogItem[]>([]);
  const [supplementStreaks, setSupplementStreaks] = useState<Record<string, number>>({});
  const [supplementsTaken, setSupplementsTaken] = useState(0);
  const [supplementsTotal, setSupplementsTotal] = useState(0);

  const loadSummaries = useCallback(async () => {
    try {
      const today = todayDateString();
      const [nutrition, caffeine, sleep, dailyChart, supplementLogs] = await Promise.all([
        nutritionService.getTodayNutrition(),
        caffeineService.getActiveCaffeine(),
        caffeineService.willInterfereWithSleep(caffeineService.getDefaultBedtime()),
        caffeineService.getDailyChart(),
        supplementService.getTodayLogs(today),
      ]);
      setNutritionData(nutrition);
      setActiveCaffeine(caffeine);
      setSleepCheck(sleep);
      setCaffeineTimeline(dailyChart.timeline);
      setSupplementItems(supplementLogs);
      setSupplementsTotal(supplementLogs.length);
      setSupplementsTaken(supplementLogs.filter((log) => log.takenAt).length);

      const takenLogs = supplementLogs.filter((log) => log.takenAt);
      const streakEntries = await Promise.all(
        takenLogs.map(async (log) => [log.supplementId, await supplementService.getStreak(log.supplementId)] as const)
      );
      setSupplementStreaks(Object.fromEntries(streakEntries));
    } catch (error) {
      console.error('Error loading intake summaries:', error);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  useFocusEffect(
    useCallback(() => {
      loadSummaries();
    }, [loadSummaries])
  );

  const totalCalories = nutritionData?.totalCalories ?? 0;
  const kcalPct = Math.min(100, (totalCalories / CALORIE_GOAL) * 100);
  const suppPct = supplementsTotal > 0 ? (supplementsTaken / supplementsTotal) * 100 : 0;
  const currentCaffeineLevel = Math.round(activeCaffeine?.currentLevel ?? 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Intake" />
      <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d').toUpperCase()}</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.push('/macros')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.warning}>
            <LinearGradient
              colors={[`${OrialColors.warning}26`, 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.warning + '20' }]}>
                  <Flame size={18} color={OrialColors.warning} />
                </View>
                <Text style={styles.moduleTitle}>Macros</Text>
              </View>
              <ChevronRight size={18} color={OrialColors.textMuted} />
            </View>

            <View style={styles.macrosBody}>
              <Ring pct={kcalPct} size={92} strokeWidth={8} color={OrialColors.warning}>
                <Text style={styles.kcalRingValue}>{Math.round(kcalPct)}%</Text>
                <Text style={styles.kcalRingUnit}>
                  {totalCalories}/{CALORIE_GOAL}
                </Text>
              </Ring>
              <View style={styles.macroDots}>
                <MacroDotRow color={OrialColors.error} label="Protein" value={nutritionData?.proteinG ?? 0} goal={MACRO_GOALS.protein} />
                <MacroDotRow color={OrialColors.cyan} label="Carbs" value={nutritionData?.carbsG ?? 0} goal={MACRO_GOALS.carbs} />
                <MacroDotRow color={OrialColors.violetLight} label="Fat" value={nutritionData?.fatG ?? 0} goal={MACRO_GOALS.fat} />
              </View>
            </View>
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => router.push('/caffeine')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.cyan}>
            <LinearGradient
              colors={[`${OrialColors.cyan}26`, 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.cyan + '20' }]}>
                  <Coffee size={18} color={OrialColors.cyan} />
                </View>
                <Text style={styles.moduleTitle}>Caffeine</Text>
              </View>
              <Text style={styles.caffeineLevelBadge}>{currentCaffeineLevel}mg</Text>
            </View>
            {caffeineTimeline.length > 1 && (
              <View style={styles.sparklineWrap}>
                <AreaChart
                  data={caffeineTimeline.map((point) => point.mg)}
                  width={SPARKLINE_WIDTH}
                  height={SPARKLINE_HEIGHT}
                  color={OrialColors.cyan}
                />
              </View>
            )}
            {sleepCheck && (
              <View style={styles.sleepStatusRow}>
                {sleepCheck.interfere ? (
                  <AlertTriangle size={13} color={OrialColors.warning} />
                ) : (
                  <Check size={13} color={OrialColors.success} />
                )}
                <Text
                  style={[
                    styles.sleepStatusText,
                    { color: sleepCheck.interfere ? OrialColors.warning : OrialColors.success },
                  ]}
                >
                  {sleepCheck.interfere ? 'Podría interferir con tu sueño' : 'No interfiere con el sueño'}
                </Text>
              </View>
            )}
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => router.push('/supplements')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.violetLight}>
            <LinearGradient
              colors={[`${OrialColors.violet}26`, 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.violet + '20' }]}>
                  <Pill size={18} color={OrialColors.violetLight} />
                </View>
                <Text style={styles.moduleTitle}>Supplements</Text>
              </View>
              <ChevronRight size={18} color={OrialColors.textMuted} />
            </View>

            {supplementsTotal > 0 ? (
              <View style={styles.suppBody}>
                <Ring pct={suppPct} size={76} strokeWidth={7} color={OrialColors.violetLight}>
                  <Text style={styles.suppRingValue}>
                    {supplementsTaken}/{supplementsTotal}
                  </Text>
                  <Text style={styles.suppRingUnit}>HOY</Text>
                </Ring>
                <View style={styles.suppList}>
                  {supplementItems.map((item) => {
                    const streak = supplementStreaks[item.supplementId];
                    return (
                      <View key={item.supplement.id} style={styles.suppListRow}>
                        <View style={[styles.suppCheck, item.takenAt ? styles.suppCheckDone : styles.suppCheckPending]}>
                          {item.takenAt && <Check size={9} color={OrialColors.success} />}
                        </View>
                        <Text style={styles.suppListLabel} numberOfLines={1}>
                          {item.supplement.name}
                        </Text>
                        {item.takenAt && streak > 1 && (
                          <View style={styles.suppStreak}>
                            <Flame size={11} color={OrialColors.warning} />
                            <Text style={styles.suppStreakText}>{streak}d</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.moduleSummary}>No supplements set up</Text>
            )}
          </GlassCard>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroDotRow({ color, label, value, goal }: { color: string; label: string; value: number; goal: number }) {
  return (
    <View style={styles.macroDotRow}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroDotLabel}>{label}</Text>
      <Text style={styles.macroDotGrams}>
        {value}g / {goal}g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  dateLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 12,
  },
  scrollContent: { paddingHorizontal: 16, gap: 14 },
  moduleCard: { padding: 20, borderRadius: 22, overflow: 'hidden' },
  moduleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  moduleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moduleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { fontSize: 15, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold' },
  moduleSummary: { fontSize: 13, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },

  // Macros
  macrosBody: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  kcalRingValue: { fontSize: 20, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold', letterSpacing: -0.4 },
  kcalRingUnit: { fontSize: 9, color: OrialColors.textMuted, fontFamily: 'Inter-Medium', letterSpacing: 0.6, marginTop: 1 },
  macroDots: { flex: 1, gap: 9 },
  macroDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
  macroDotLabel: { width: 56, fontSize: 12, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
  macroDotGrams: { fontSize: 12, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },

  // Caffeine
  caffeineLevelBadge: { fontSize: 20, fontWeight: '700', color: OrialColors.cyan, fontFamily: 'Inter-Bold', letterSpacing: -0.4 },
  sparklineWrap: { marginTop: 10, marginBottom: 4 },
  sleepStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sleepStatusText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter-SemiBold' },

  // Supplements
  suppBody: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  suppRingValue: { fontSize: 16, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold' },
  suppRingUnit: { fontSize: 8, color: OrialColors.textMuted, fontFamily: 'Inter-Medium', letterSpacing: 0.8 },
  suppList: { flex: 1, gap: 8 },
  suppListRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suppCheck: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  suppCheckDone: { backgroundColor: OrialColors.success + '33' },
  suppCheckPending: { backgroundColor: OrialColors.surfaceElevated, borderWidth: 1, borderColor: OrialColors.borderStrong },
  suppListLabel: { flex: 1, fontSize: 12, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
  suppStreak: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  suppStreakText: { fontSize: 11, fontWeight: '600', color: OrialColors.warning, fontFamily: 'Inter-SemiBold' },
});
