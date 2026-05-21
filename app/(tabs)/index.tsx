import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Activity, Heart, Droplets, Pill, TrendingDown,
  Flame, Moon, Zap, ZapOff } from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { whoopService } from '../../src/services/whoopService';
import { hydrationService } from '../../src/services/hydrationService';
import { supplementService } from '../../src/services/supplementService';
import { manualMetricsService } from '../../src/services/manualMetricsService';
import { weightPredictionService } from '../../src/services/weightPredictionService';
import { nutritionService } from '../../src/services/nutritionService';
import type { WhoopDaily, ManualMetric, WeightPrediction, NutritionLog } from '../../drizzle/schema';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function recoveryColor(score: number | null | undefined): string {
  if (!score) return OrialColors.textMuted;
  if (score >= 67) return OrialColors.success;
  if (score >= 34) return OrialColors.warning;
  return OrialColors.error;
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopDaily | null>(null);
  const [isWhoopConnected, setIsWhoopConnected] = useState(false);
  const [hydrationData, setHydrationData] = useState<{ current: number; target: number; percentage: number }>({ current: 0, target: 3, percentage: 0 });
  const [supplements, setSupplements] = useState<{ supplementId: string; name: string; dailyDoseMg: number; takenAt: Date | null; streak: number }[]>([]);
  const [manualData, setManualData] = useState<ManualMetric | null>(null);
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionLog | null>(null);
  const router = useRouter();

  const loadAllData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const connected = await whoopService.isConnected();
      if (connected) await whoopService.syncToday();
      const [whoop, hyd, allSupps, manual, pred, nutrition, todayLogs] = await Promise.all([
        whoopService.getTodayMetrics(),
        hydrationService.getProgress(),
        supplementService.getSupplements(),
        manualMetricsService.getTodayMetrics(),
        weightPredictionService.getTodayPrediction(),
        nutritionService.getTodayNutrition(),
        supplementService.getTodayLogs(today),
      ]);
      setIsWhoopConnected(connected);
      setWhoopData(whoop);
      setHydrationData(hyd);
      setManualData(manual);
      setPrediction(pred);
      setNutritionData(nutrition);

      const suppList = await Promise.all(allSupps.map(async (s) => {
        const tlog = (todayLogs as any[]).find((l: any) => l.supplementId === s.id);
        const streak = await supplementService.getStreak(s.id);
        return { supplementId: s.id, name: s.name, dailyDoseMg: s.dailyDoseMg, takenAt: tlog?.takenAt || null, streak };
      }));
      setSupplements(suppList);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadWhoopData = async () => {
    try {
      const connected = await whoopService.isConnected();
      if (connected) await whoopService.syncToday();
      const whoop = await whoopService.getTodayMetrics();
      setIsWhoopConnected(connected);
      setWhoopData(whoop);
    } catch (error) {
      console.error('Error syncing WHOOP:', error);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadWhoopData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleAddWater = async () => {
    const today = new Date().toISOString().split('T')[0];
    await hydrationService.addWater(today, 0.25);
    const progress = await hydrationService.getProgress(today);
    setHydrationData(progress);
  };

  const handleLogSupplement = async (supplementId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const supp = supplements.find(s => s.supplementId === supplementId);
    if (supp) {
      await supplementService.logSupplement(supplementId, today, supp.dailyDoseMg);
      setSupplements(prev => prev.map(s =>
        s.supplementId === supplementId ? { ...s, takenAt: new Date() } : s
      ));
    }
  };

  const hydPct = Math.min(hydrationData.percentage, 100);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OrialColors.violetLight} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d').toUpperCase()}</Text>
        </View>

        {/* WHOOP */}
        <View style={styles.section}>
          <SectionLabel label="WHOOP" />
          {!isWhoopConnected ? (
            <Pressable onPress={() => router.push('/forge')}>
              <GlassCard style={styles.whoopDisconnectedCard} accentColor={OrialColors.warning}>
                <View style={styles.whoopDisconnectedRow}>
                  <View style={styles.warningIconCircle}>
                    <ZapOff size={20} color={OrialColors.warning} />
                  </View>
                  <View style={styles.whoopDisconnectedTextContainer}>
                    <Text style={styles.whoopDisconnectedTitle}>Connection Required</Text>
                    <Text style={styles.whoopDisconnectedSubtitle}>
                      WHOOP is disconnected. Tap here to link your device and sync your strain, recovery, and sleep metrics.
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ) : whoopData ? (
            <Pressable onPress={() => router.push('/forge')}>
              <View style={styles.whoopGrid}>
                <View style={styles.whoopRow}>
                  <WhoopMetricCard
                    icon={<Zap size={13} color={OrialColors.cyan} />}
                    value={whoopData.strain?.toFixed(1) || '--'}
                    label="STRAIN"
                    accent={OrialColors.cyan}
                  />
                  <WhoopMetricCard
                    icon={<Heart size={13} color={recoveryColor(whoopData.recoveryScore)} />}
                    value={whoopData.recoveryScore ? `${whoopData.recoveryScore}%` : '--'}
                    label="RECOVERY"
                    accent={recoveryColor(whoopData.recoveryScore)}
                  />
                </View>
                <View style={styles.whoopRow}>
                  <WhoopMetricCard
                    icon={<Moon size={13} color={OrialColors.violetLight} />}
                    value={whoopData.sleepPerformance ? `${whoopData.sleepPerformance}%` : '--'}
                    label="SLEEP"
                    accent={OrialColors.violetLight}
                  />
                  <WhoopMetricCard
                    icon={<Activity size={13} color={OrialColors.warning} />}
                    value={whoopData.hrvRmssdMilli?.toFixed(0) || '--'}
                    label="HRV"
                    accent={OrialColors.warning}
                  />
                </View>
              </View>
              <View style={styles.whoopDetails}>
                <View style={styles.whoopDetailItem}>
                  <Flame size={11} color={OrialColors.warning} />
                  <Text style={styles.whoopDetailText}>
                    {whoopData.kilojoule ? Math.round(whoopData.kilojoule * 0.239) : '--'} kcal
                  </Text>
                </View>
                <View style={styles.whoopDetailDivider} />
                <View style={styles.whoopDetailItem}>
                  <Heart size={11} color={OrialColors.error} />
                  <Text style={styles.whoopDetailText}>RHR {whoopData.restingHeartRate || '--'} bpm</Text>
                </View>
                <View style={styles.whoopDetailDivider} />
                <View style={styles.whoopDetailItem}>
                  <Moon size={11} color={OrialColors.violetLight} />
                  <Text style={styles.whoopDetailText}>
                    {whoopData.sleepDurationMilli
                      ? `${Math.round(whoopData.sleepDurationMilli / 3600000 * 10) / 10}h sleep`
                      : '--'}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/forge')}>
              <GlassCard style={styles.whoopDisconnectedCard} accentColor={OrialColors.violetLight}>
                <View style={styles.whoopDisconnectedRow}>
                  <View style={[styles.warningIconCircle, { backgroundColor: OrialColors.violet + '15' }]}>
                    <Zap size={20} color={OrialColors.violetLight} />
                  </View>
                  <View style={styles.whoopDisconnectedTextContainer}>
                    <Text style={styles.whoopDisconnectedTitle}>Connected · No Sync</Text>
                    <Text style={styles.whoopDisconnectedSubtitle}>
                      Connected but no data loaded for today. Pull to refresh or tap to manage your health metrics.
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          )}
        </View>

        {/* Hydration */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel label="HYDRATION" inline />
            <Pressable onPress={() => router.push('/hydration-history')}>
              <Text style={styles.historyLink}>History</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/hydration')}>
            <GlassCard style={styles.hydrationCard}>
              <View style={styles.hydrationTop}>
                <View style={styles.hydrationLeft}>
                  <Droplets size={18} color={OrialColors.cyan} />
                  <View style={styles.hydrationNums}>
                    <Text style={styles.hydrationValue}>{hydrationData.current.toFixed(1)}</Text>
                    <Text style={styles.hydrationUnit}>/ {hydrationData.target.toFixed(1)} L</Text>
                  </View>
                </View>
                <View style={[styles.pctBadge, { borderColor: (hydPct >= 100 ? OrialColors.success : OrialColors.cyan) + '40' }]}>
                  <Text style={[styles.pctBadgeValue, { color: hydPct >= 100 ? OrialColors.success : OrialColors.cyan }]}>
                    {hydrationData.percentage.toFixed(0)}%
                  </Text>
                  <Text style={styles.pctBadgeLabel}>DONE</Text>
                </View>
              </View>
              <View style={styles.progressBarWrap}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${hydPct}%`, backgroundColor: hydPct >= 100 ? OrialColors.success : OrialColors.cyan }]} />
                </View>
              </View>
              <View style={styles.hydrationActions}>
                <Pressable style={styles.waterBtn} onPress={handleAddWater}>
                  <Text style={styles.waterBtnText}>+250 ml</Text>
                </Pressable>
                <Pressable
                  style={[styles.waterBtn, styles.waterBtnSecondary]}
                  onPress={async () => {
                    const today = new Date().toISOString().split('T')[0];
                    await hydrationService.addWater(today, 0.5, 'soda_zero');
                    const progress = await hydrationService.getProgress(today);
                    setHydrationData(progress);
                  }}
                >
                  <Text style={[styles.waterBtnText, styles.waterBtnSecondaryText]}>+500 ml Zero</Text>
                </Pressable>
              </View>
            </GlassCard>
          </Pressable>
        </View>

        {/* Macros */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel label="MACROS" inline />
            <Pressable onPress={() => router.push('/nutrition-history')}>
              <Text style={styles.historyLink}>History</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.push('/macros')}>
            <GlassCard style={styles.nutritionCard}>
              {nutritionData ? (
                <>
                  <View style={styles.calorieRow}>
                    <View>
                      <Text style={styles.calorieValue}>{nutritionData.totalCalories ?? 0}</Text>
                      <Text style={styles.calorieLabel}>KCAL TODAY</Text>
                    </View>
                    <View style={styles.calorieGoal}>
                      <Text style={styles.goalLabel}>GOAL</Text>
                      <Text style={styles.goalValue}>2100</Text>
                    </View>
                  </View>
                  <View style={styles.calorieTrack}>
                    <View style={[styles.calorieFill, {
                      width: `${Math.min(((nutritionData.totalCalories ?? 0) / 2100) * 100, 100).toFixed(0)}%` as any,
                      backgroundColor: (nutritionData.totalCalories ?? 0) >= 2100 ? OrialColors.success : OrialColors.warning,
                    }]} />
                  </View>
                  <View style={styles.macroMiniBars}>
                    <MacroMiniBar label="PRO" current={nutritionData.proteinG ?? 0} goal={160} color={OrialColors.error} />
                    <MacroMiniBar label="CHO" current={nutritionData.carbsG ?? 0} goal={220} color={OrialColors.cyan} />
                    <MacroMiniBar label="FAT" current={nutritionData.fatG ?? 0} goal={70} color={OrialColors.violetLight} />
                  </View>
                  {nutritionData.sodiumMg ? (
                    <View style={styles.sodiumBadge}>
                      <Text style={styles.sodiumText}>{nutritionData.sodiumMg}mg Na · +{(nutritionData.sodiumMg / 2300).toFixed(2)}L H₂O</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.nutritionEmpty}>
                  <Flame size={20} color={OrialColors.textMuted} />
                  <Text style={styles.nutritionEmptyText}>No macros logged today</Text>
                  <Text style={styles.nutritionEmptySubtext}>Chat with Hermes to log meals</Text>
                </View>
              )}
            </GlassCard>
          </Pressable>
        </View>

        {/* Activity */}
        <View style={styles.section}>
          <Pressable onPress={() => router.push('/metrics-manual')}>
            <SectionLabel label="ACTIVITY" />
          </Pressable>
          <GlassCard style={styles.activityCard}>
            <View style={styles.activityRow}>
              <View style={styles.activityItem}>
                <Text style={styles.activityNumber}>{(manualData?.stepsWalk || 0).toLocaleString()}</Text>
                <Text style={styles.activityLabel}>STEPS</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityItem}>
                <Text style={styles.activityNumber}>{manualData?.workoutMinutes || '--'}</Text>
                <Text style={styles.activityLabel}>MIN WORKOUT</Text>
              </View>
              <View style={styles.activityDivider} />
              <View style={styles.activityItem}>
                <Text style={styles.activityNumber}>{manualData?.caloriesIn || '--'}</Text>
                <Text style={styles.activityLabel}>KCAL IN</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Supplements */}
        <View style={styles.section}>
          <Pressable onPress={() => router.push('/supplements')}>
            <SectionLabel label="SUPPLEMENTS" />
          </Pressable>
          {supplements.length > 0 ? (
            supplements.map((s) => (
              <Pressable key={s.supplementId} onPress={() => router.push('/supplements')}>
              <GlassCard style={styles.supplementCard}>
                <View style={styles.supplementRow}>
                  <View style={styles.supplementInfo}>
                    <View style={styles.supplementIconWrap}>
                      <Pill size={15} color={OrialColors.violetLight} />
                    </View>
                    <View>
                      <Text style={styles.supplementName}>{s.name}</Text>
                      <Text style={styles.supplementDose}>{s.dailyDoseMg}mg daily</Text>
                    </View>
                  </View>
                  <View style={styles.supplementRight}>
                    <View style={styles.supplementStreakBadge}>
                      <Flame size={11} color={s.streak > 0 ? OrialColors.warning : OrialColors.textMuted} />
                      <Text style={[styles.supplementStreakText, { color: s.streak > 0 ? OrialColors.warning : OrialColors.textMuted }]}>
                        {s.streak}d
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.supplementButton, s.takenAt ? styles.supplementTaken : styles.supplementPending]}
                      onPress={(e) => { e.stopPropagation(); if (!s.takenAt) handleLogSupplement(s.supplementId); }}
                    >
                      <Text style={[styles.supplementButtonText, s.takenAt && styles.supplementTakenText]}>
                        {s.takenAt ? '✓' : 'Take'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </GlassCard>
              </Pressable>
            ))
          ) : (
            <Pressable onPress={() => router.push('/supplements')}>
              <GlassCard style={styles.supplementCard}>
                <View style={[styles.supplementRow, { justifyContent: 'center', paddingVertical: 6 }]}>
                  <Pill size={16} color={OrialColors.textMuted} />
                  <Text style={styles.nutritionEmptyText}>Add supplements →</Text>
                </View>
              </GlassCard>
            </Pressable>
          )}
        </View>

        {/* Weight Prediction */}
        {prediction && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Pressable onPress={() => router.push('/metrics-manual')}>
                <SectionLabel label="WEIGHT PREDICTION" inline />
              </Pressable>
              <Pressable onPress={() => router.push('/weight-history')}>
                <Text style={styles.historyLink}>History</Text>
              </Pressable>
            </View>
            <GlassCard style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <View style={styles.predictionIconWrap}>
                  <TrendingDown size={16} color={OrialColors.cyan} />
                </View>
                <View style={styles.predictionInfo}>
                  <Text style={styles.predictionValue}>{prediction.predictedWeightKg?.toFixed(2) || '--'} kg</Text>
                  <Text style={styles.predictionLabel}>PREDICTED TOMORROW</Text>
                </View>
              </View>
              {prediction.predictionRangeLow && prediction.predictionRangeHigh && (
                <View style={styles.rangeBar}>
                  <View style={styles.rangeTrack}>
                    <View style={styles.rangeFill} />
                  </View>
                  <View style={styles.rangeLabels}>
                    <Text style={styles.rangeText}>{prediction.predictionRangeLow.toFixed(2)} kg</Text>
                    <Text style={styles.rangeText}>{prediction.predictionRangeHigh.toFixed(2)} kg</Text>
                  </View>
                </View>
              )}
              {prediction.factors && (
                <View style={styles.factorsContainer}>
                  {JSON.parse(prediction.factors).map((factor: string, index: number) => (
                    <Text key={index} style={styles.factorItem}>· {factor}</Text>
                  ))}
                </View>
              )}
            </GlassCard>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ label, inline }: { label: string; inline?: boolean }) {
  return (
    <View style={[sectionLabelStyles.wrap, inline && sectionLabelStyles.inlineWrap]}>
      <View style={sectionLabelStyles.dot} />
      <Text style={sectionLabelStyles.text}>{label}</Text>
    </View>
  );
}

const sectionLabelStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, marginBottom: 10 },
  inlineWrap: { paddingHorizontal: 0, marginBottom: 0 },
  dot: { width: 3, height: 12, borderRadius: 2, backgroundColor: OrialColors.violetLight },
  text: { fontSize: 10, letterSpacing: 1.5, color: OrialColors.textSecondary, fontFamily: 'Inter-Medium' },
});

function WhoopMetricCard({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent: string }) {
  return (
    <View style={[whoopCardStyles.card, { borderColor: accent + '28' }]}>
      <View style={[whoopCardStyles.iconPill, { backgroundColor: accent + '18' }]}>{icon}</View>
      <Text style={[whoopCardStyles.value, { color: accent }]}>{value}</Text>
      <Text style={whoopCardStyles.label}>{label}</Text>
    </View>
  );
}

const whoopCardStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: OrialColors.surface, borderRadius: 14, borderWidth: 1, padding: 14, gap: 6 },
  iconPill: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value: { fontSize: 28, fontWeight: '700', letterSpacing: -1, fontFamily: 'Inter-Bold' },
  label: { fontSize: 9, letterSpacing: 1.4, color: OrialColors.textMuted, fontFamily: 'Inter-Medium' },
});

function MacroMiniBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <View style={styles.macroMiniRow}>
      <Text style={styles.macroMiniLabel}>{label}</Text>
      <View style={styles.macroMiniTrack}>
        <View style={[styles.macroMiniFill, { width: `${(pct * 100).toFixed(0)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroMiniValue}>{current}g/{goal}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  greeting: { fontSize: 30, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.8, fontFamily: 'Inter-Bold' },
  dateLabel: { fontSize: 10, letterSpacing: 1.6, color: OrialColors.textMuted, marginTop: 5, fontFamily: 'Inter-Medium' },
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  historyLink: { fontSize: 11, color: OrialColors.cyan, fontFamily: 'Inter-Medium', letterSpacing: 0.3 },
  whoopGrid: { paddingHorizontal: 16, gap: 8 },
  whoopRow: { flexDirection: 'row', gap: 8 },
  whoopDetails: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 },
  whoopDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, justifyContent: 'center' },
  whoopDetailDivider: { width: 1, height: 12, backgroundColor: OrialColors.border },
  whoopDetailText: { fontSize: 11, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },
  hydrationCard: { marginHorizontal: 16, padding: 16 },
  hydrationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  hydrationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hydrationNums: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hydrationValue: { fontSize: 40, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -1.5, fontFamily: 'Inter-Bold' },
  hydrationUnit: { fontSize: 14, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
  pctBadge: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 10, backgroundColor: OrialColors.surfaceElevated },
  pctBadgeValue: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5, fontFamily: 'Inter-Bold' },
  pctBadgeLabel: { fontSize: 8, letterSpacing: 1.2, color: OrialColors.textMuted, fontFamily: 'Inter-Medium', marginTop: 1 },
  progressBarWrap: { marginBottom: 14 },
  progressBar: { height: 4, backgroundColor: OrialColors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  hydrationActions: { flexDirection: 'row', gap: 8 },
  waterBtn: { flex: 1, backgroundColor: OrialColors.cyan + '18', paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: OrialColors.cyan + '35' },
  waterBtnSecondary: { backgroundColor: OrialColors.surfaceElevated, borderColor: OrialColors.borderStrong },
  waterBtnText: { color: OrialColors.cyan, fontWeight: '600', fontSize: 13, fontFamily: 'Inter-SemiBold' },
  waterBtnSecondaryText: { color: OrialColors.textSecondary },
  nutritionCard: { marginHorizontal: 16, padding: 16 },
  calorieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  calorieValue: { fontSize: 44, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -1.5, lineHeight: 48, fontFamily: 'Inter-Bold' },
  calorieLabel: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, marginTop: 3, fontFamily: 'Inter-Medium' },
  calorieGoal: { alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: OrialColors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: OrialColors.border },
  goalLabel: { fontSize: 8, letterSpacing: 1.2, color: OrialColors.textMuted, fontFamily: 'Inter-Medium' },
  goalValue: { fontSize: 17, fontWeight: '600', color: OrialColors.textSecondary, fontFamily: 'Inter-SemiBold', letterSpacing: -0.3 },
  calorieTrack: { height: 3, backgroundColor: OrialColors.surfaceElevated, borderRadius: 2, overflow: 'hidden', marginBottom: 14 },
  calorieFill: { height: '100%', borderRadius: 2 },
  macroMiniBars: { gap: 8, marginBottom: 4 },
  macroMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macroMiniLabel: { width: 30, color: OrialColors.textMuted, fontSize: 9, letterSpacing: 0.8, fontFamily: 'Inter-Medium' },
  macroMiniTrack: { flex: 1, height: 3, backgroundColor: OrialColors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  macroMiniFill: { height: '100%', borderRadius: 2 },
  macroMiniValue: { width: 56, textAlign: 'right', color: OrialColors.textMuted, fontSize: 10, fontFamily: 'Inter-Regular' },
  nutritionEmpty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  nutritionEmptyText: { color: OrialColors.textSecondary, fontWeight: '600', fontSize: 14, fontFamily: 'Inter-SemiBold' },
  nutritionEmptySubtext: { color: OrialColors.textMuted, fontSize: 12, fontFamily: 'Inter-Regular' },
  sodiumBadge: { backgroundColor: OrialColors.warning + '10', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: OrialColors.warning + '22' },
  sodiumText: { color: OrialColors.warning, fontSize: 11, letterSpacing: 0.3, fontFamily: 'Inter-Regular' },
  activityCard: { marginHorizontal: 16, padding: 0 },
  activityRow: { flexDirection: 'row' },
  activityItem: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  activityDivider: { width: 1, backgroundColor: OrialColors.border, marginVertical: 14 },
  activityNumber: { fontSize: 24, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.5, fontFamily: 'Inter-Bold' },
  activityLabel: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, marginTop: 4, fontFamily: 'Inter-Medium' },
  supplementCard: { marginHorizontal: 16, marginBottom: 6, padding: 14 },
  supplementRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  supplementInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  supplementIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: OrialColors.violet + '18', alignItems: 'center', justifyContent: 'center' },
  supplementName: { fontSize: 14, fontWeight: '600', color: OrialColors.textPrimary, fontFamily: 'Inter-SemiBold' },
  supplementDose: { fontSize: 11, color: OrialColors.textMuted, marginTop: 2, fontFamily: 'Inter-Regular' },
  supplementRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supplementStreakBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: OrialColors.surfaceElevated, borderWidth: 1, borderColor: OrialColors.border },
  supplementStreakText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter-SemiBold' },
  supplementButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 56, alignItems: 'center', borderWidth: 1 },
  supplementPending: { backgroundColor: OrialColors.violet + '20', borderColor: OrialColors.violet + '45' },
  supplementTaken: { backgroundColor: OrialColors.success + '12', borderColor: OrialColors.success + '35' },
  supplementButtonText: { color: OrialColors.violetLight, fontWeight: '600', fontSize: 12, fontFamily: 'Inter-SemiBold' },
  supplementTakenText: { color: OrialColors.success },
  predictionCard: { marginHorizontal: 16, padding: 16 },
  predictionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  predictionIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: OrialColors.cyan + '18', alignItems: 'center', justifyContent: 'center' },
  predictionInfo: { flex: 1 },
  predictionValue: { fontSize: 28, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.8, fontFamily: 'Inter-Bold' },
  predictionLabel: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, marginTop: 3, fontFamily: 'Inter-Medium' },
  rangeBar: { marginBottom: 10 },
  rangeTrack: { height: 3, backgroundColor: OrialColors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  rangeFill: { height: '100%', backgroundColor: OrialColors.cyan, borderRadius: 2, width: '100%' },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  rangeText: { fontSize: 10, color: OrialColors.textMuted, fontFamily: 'Inter-Regular' },
  factorsContainer: { marginTop: 6, gap: 3 },
  factorItem: { fontSize: 11, color: OrialColors.textMuted, fontFamily: 'Inter-Regular', lineHeight: 18 },
  whoopDisconnectedCard: { marginHorizontal: 16, padding: 16 },
  whoopDisconnectedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  warningIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: OrialColors.warning + '15', alignItems: 'center', justifyContent: 'center' },
  whoopDisconnectedTextContainer: { flex: 1, gap: 4 },
  whoopDisconnectedTitle: { fontSize: 14, fontWeight: '600', color: OrialColors.textPrimary, fontFamily: 'Inter-SemiBold' },
  whoopDisconnectedSubtitle: { fontSize: 11, color: OrialColors.textMuted, lineHeight: 16, fontFamily: 'Inter-Regular' },
});
