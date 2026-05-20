import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { 
  Activity, Heart, Droplets, Pill, TrendingDown, 
  Flame, Moon, Zap, ChevronRight 
} from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { whoopService } from '../../src/services/whoopService';
import { hydrationService } from '../../src/services/hydrationService';
import { supplementService } from '../../src/services/supplementService';
import { manualMetricsService } from '../../src/services/manualMetricsService';
import { weightPredictionService } from '../../src/services/weightPredictionService';
import { nutritionService } from '../../src/services/nutritionService';
import type { WhoopDaily, Hydration, SupplementLog, ManualMetric, WeightPrediction, NutritionLog } from '../../drizzle/schema';

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopDaily | null>(null);
  const [hydrationData, setHydrationData] = useState<{ current: number; target: number; percentage: number }>({ current: 0, target: 3, percentage: 0 });
  const [supplementLogs, setSupplementLogs] = useState<(SupplementLog & { supplement: { name: string; dailyDoseMg: number } })[]>([]);
  const [manualData, setManualData] = useState<ManualMetric | null>(null);
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionLog | null>(null);
  const [steps, setSteps] = useState(0);
  const router = useRouter();

  const loadAllData = async () => {
    try {
      const [
        whoop,
        hyd,
        supps,
        manual,
        pred,
        nutrition,
        stepData
      ] = await Promise.all([
        whoopService.getTodayMetrics(),
        hydrationService.getProgress(),
        supplementService.getTodayLogs(),
        manualMetricsService.getTodayMetrics(),
        weightPredictionService.getTodayPrediction(),
        nutritionService.getTodayNutrition(),
        Promise.resolve(0),
      ]);

      setWhoopData(whoop);
      setHydrationData(hyd);
      setSupplementLogs(supps as any);
      setManualData(manual);
      setPrediction(pred);
      setNutritionData(nutrition);
      setSteps(stepData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  useEffect(() => {
    loadAllData();
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
    const supplement = supplementLogs.find(s => s.supplementId === supplementId)?.supplement;
    if (supplement) {
      await supplementService.logSupplement(supplementId, today, supplement.dailyDoseMg);
      const logs = await supplementService.getTodayLogs();
      setSupplementLogs(logs as any);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={OrialColors.violetLight}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={OrialTypography.caption}>{format(new Date(), 'EEEE, MMM d')}</Text>
            <Text style={OrialTypography.headingMedium}>Dashboard</Text>
          </View>
        </View>

        {/* Whoop Metrics */}
        {whoopData && (
          <View style={styles.section}>
            <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Whoop Metrics</Text>
            <View style={styles.metricsGrid}>
              <GlassCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Zap size={20} color={OrialColors.cyan} />
                </View>
                <Text style={OrialTypography.headingMedium}>{whoopData.strain?.toFixed(1) || '--'}</Text>
                <Text style={OrialTypography.caption}>Strain</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Heart size={20} color={OrialColors.error} />
                </View>
                <Text style={OrialTypography.headingMedium}>{whoopData.recoveryScore || '--'}%</Text>
                <Text style={OrialTypography.caption}>Recovery</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Moon size={20} color={OrialColors.violetLight} />
                </View>
                <Text style={OrialTypography.headingMedium}>{whoopData.sleepPerformance || '--'}%</Text>
                <Text style={OrialTypography.caption}>Sleep</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <View style={styles.metricIcon}>
                  <Activity size={20} color={OrialColors.warning} />
                </View>
                <Text style={OrialTypography.headingMedium}>{whoopData.hrvRmssdMilli?.toFixed(0) || '--'}</Text>
                <Text style={OrialTypography.caption}>HRV</Text>
              </GlassCard>
            </View>

            <GlassCard style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Flame size={16} color={OrialColors.warning} />
                <Text style={[OrialTypography.bodyMedium, styles.detailValue]}>
                  {whoopData.kilojoule ? Math.round(whoopData.kilojoule * 0.239) : '--'} kcal burned
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Heart size={16} color={OrialColors.error} />
                <Text style={[OrialTypography.bodyMedium, styles.detailValue]}>
                  RHR: {whoopData.restingHeartRate || '--'} bpm
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Moon size={16} color={OrialColors.violetLight} />
                <Text style={[OrialTypography.bodyMedium, styles.detailValue]}>
                  Sleep: {whoopData.sleepDurationMilli ? Math.round(whoopData.sleepDurationMilli / 3600000 * 10) / 10 : '--'}h
                </Text>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Hydration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Pressable onPress={() => router.push('/hydration')} style={styles.sectionTitlePressable}>
              <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Hydration <ChevronRight size={16} color={OrialColors.textMuted} /></Text>
            </Pressable>
            <Pressable onPress={() => router.push('/hydration-history')}>
              <Text style={[OrialTypography.caption, styles.historyLink]}>View History</Text>
            </Pressable>
          </View>
          <GlassCard style={styles.hydrationCard}>
            <View style={styles.hydrationHeader}>
              <View style={styles.hydrationIcon}>
                <Droplets size={24} color={OrialColors.cyan} />
              </View>
              <View style={styles.hydrationInfo}>
                <Text style={OrialTypography.headingMedium}>
                  {hydrationData.current.toFixed(2)}L / {hydrationData.target.toFixed(2)}L
                </Text>
                <Text style={OrialTypography.caption}>
                  {hydrationData.percentage.toFixed(0)}% of daily target
                </Text>
              </View>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(hydrationData.percentage, 100)}%`,
                      backgroundColor: hydrationData.percentage >= 100 ? OrialColors.success : OrialColors.cyan
                    }
                  ]} 
                />
              </View>
            </View>
            
            <View style={styles.hydrationActions}>
              <Pressable style={styles.waterButton} onPress={handleAddWater}>
                <Text style={styles.waterButtonText}>+250ml Water</Text>
              </Pressable>
              <Pressable 
                style={[styles.waterButton, styles.waterButtonSecondary]}
                onPress={async () => {
                  const today = new Date().toISOString().split('T')[0];
                  await hydrationService.addWater(today, 0.5, 'soda_zero');
                  const progress = await hydrationService.getProgress(today);
                  setHydrationData(progress);
                }}
              >
                <Text style={[styles.waterButtonText, styles.waterButtonSecondaryText]}>+500ml Zero</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>

        {/* Macros Summary */}
        {nutritionData && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Pressable onPress={() => router.push('/macros')} style={styles.sectionTitlePressable}>
                <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Macros <ChevronRight size={16} color={OrialColors.textMuted} /></Text>
              </Pressable>
              <Pressable onPress={() => router.push('/nutrition-history')}>
                <Text style={[OrialTypography.caption, styles.historyLink]}>History</Text>
              </Pressable>
            </View>
            <GlassCard style={styles.nutritionCard}>
              <View style={styles.nutritionGrid}>
                <View style={styles.nutritionItem}>
                  <Text style={OrialTypography.headingMedium}>{nutritionData.totalCalories || '--'}</Text>
                  <Text style={OrialTypography.caption}>kcal</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={OrialTypography.headingMedium}>{nutritionData.proteinG || '--'}g</Text>
                  <Text style={OrialTypography.caption}>Protein</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={OrialTypography.headingMedium}>{nutritionData.carbsG || '--'}g</Text>
                  <Text style={OrialTypography.caption}>Carbs</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={OrialTypography.headingMedium}>{nutritionData.fatG || '--'}g</Text>
                  <Text style={OrialTypography.caption}>Fat</Text>
                </View>
              </View>
              {/* Mini progress bars */}
              <View style={styles.macroMiniBars}>
                <MacroMiniBar label="Protein" current={nutritionData.proteinG || 0} goal={160} color={OrialColors.error} />
                <MacroMiniBar label="Carbs" current={nutritionData.carbsG || 0} goal={220} color={OrialColors.cyan} />
                <MacroMiniBar label="Fat" current={nutritionData.fatG || 0} goal={70} color={OrialColors.violetLight} />
              </View>
              <Pressable onPress={() => router.push('/macros')} style={styles.macroDetailLink}>
                <Text style={[OrialTypography.caption, { color: OrialColors.violetLight }]}>Log a meal →</Text>
              </Pressable>
              {nutritionData.sodiumMg && (
                <View style={styles.sodiumBadge}>
                  <Text style={styles.sodiumText}>
                    Sodium: {nutritionData.sodiumMg}mg → +{((nutritionData.sodiumMg / 2300)).toFixed(2)}L extra water
                  </Text>
                </View>
              )}
            </GlassCard>
          </View>
        )}

        {/* Steps & Activity */}
        <View style={styles.section}>
          <Pressable onPress={() => router.push('/metrics-manual')}>
            <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Activity <ChevronRight size={16} color={OrialColors.textMuted} /></Text>
          </Pressable>
          <GlassCard style={styles.activityCard}>
            <View style={styles.activityRow}>
              <View style={styles.activityItem}>
                <Text style={OrialTypography.headingMedium}>{(manualData?.stepsWalk || 0).toLocaleString()}</Text>
                <Text style={OrialTypography.caption}>Steps</Text>
              </View>
              <View style={styles.activityItem}>
                <Text style={OrialTypography.headingMedium}>{manualData?.workoutMinutes || '--'}</Text>
                <Text style={OrialTypography.caption}>Min Workout</Text>
              </View>
              <View style={styles.activityItem}>
                <Text style={OrialTypography.headingMedium}>{manualData?.caloriesIn ? `${manualData.caloriesIn}` : '--'}</Text>
                <Text style={OrialTypography.caption}>Kcal In</Text>
              </View>
            </View>
          </GlassCard>
        </View>

        {/* Supplements */}
        {supplementLogs.length > 0 && (
          <View style={styles.section}>
            <Pressable onPress={() => router.push('/supplements')}>
              <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Supplements <ChevronRight size={16} color={OrialColors.textMuted} /></Text>
            </Pressable>
            {supplementLogs.map((log) => (
              <GlassCard key={log.supplementId} style={styles.supplementCard}>
                <View style={styles.supplementRow}>
                  <View style={styles.supplementInfo}>
                    <Pill size={20} color={OrialColors.violetLight} />
                    <View>
                      <Text style={OrialTypography.bodyMedium}>{log.supplement?.name || 'Supplement'}</Text>
                      <Text style={OrialTypography.caption}>{log.supplement?.dailyDoseMg}mg daily</Text>
                    </View>
                  </View>
                  <Pressable
                    style={[
                      styles.supplementButton,
                      log.takenAt ? styles.supplementTaken : styles.supplementPending
                    ]}
                    onPress={() => !log.takenAt && handleLogSupplement(log.supplementId)}
                  >
                    <Text style={[
                      styles.supplementButtonText,
                      log.takenAt && styles.supplementTakenText
                    ]}>
                      {log.takenAt ? '✓ Taken' : 'Take'}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Weight Prediction */}
        {prediction && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Pressable onPress={() => router.push('/metrics-manual')} style={styles.sectionTitlePressable}>
                <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Weight Prediction <ChevronRight size={16} color={OrialColors.textMuted} /></Text>
              </Pressable>
              <Pressable onPress={() => router.push('/weight-history')}>
                <Text style={[OrialTypography.caption, styles.historyLink]}>View History</Text>
              </Pressable>
            </View>
            <GlassCard style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <TrendingDown size={20} color={OrialColors.cyan} />
                <View style={styles.predictionInfo}>
                  <Text style={OrialTypography.headingMedium}>
                    {prediction.predictedWeightKg?.toFixed(2) || '--'} kg
                  </Text>
                  <Text style={OrialTypography.caption}>
                    Predicted for tomorrow
                  </Text>
                </View>
              </View>
              
              {prediction.predictionRangeLow && prediction.predictionRangeHigh && (
                <View style={styles.rangeBar}>
                  <View style={styles.rangeTrack}>
                    <View style={styles.rangeFill} />
                  </View>
                  <View style={styles.rangeLabels}>
                    <Text style={OrialTypography.caption}>{prediction.predictionRangeLow.toFixed(2)}kg</Text>
                    <Text style={OrialTypography.caption}>{prediction.predictionRangeHigh.toFixed(2)}kg</Text>
                  </View>
                </View>
              )}
              
              {prediction.factors && (
                <View style={styles.factorsContainer}>
                  <Text style={[OrialTypography.caption, styles.factorsTitle]}>Factors:</Text>
                  {JSON.parse(prediction.factors).map((factor: string, index: number) => (
                    <Text key={index} style={[OrialTypography.caption, styles.factorItem]}>
                      • {factor}
                    </Text>
                  ))}
                </View>
              )}
            </GlassCard>
          </View>
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
    padding: 16,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 12,
  },
  sectionTitlePressable: {
    flex: 1,
  },
  sectionTitle: {
    paddingHorizontal: 16,
  },
  historyLink: {
    color: OrialColors.cyan,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  metricCard: {
    width: '23%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  metricIcon: {
    marginBottom: 4,
  },
  detailCard: {
    margin: 16,
    marginTop: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailValue: {
    flex: 1,
    color: OrialColors.textSecondary,
  },
  hydrationCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  hydrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  hydrationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OrialColors.cyan + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hydrationInfo: {
    flex: 1,
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  hydrationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  waterButton: {
    flex: 1,
    backgroundColor: OrialColors.cyan + '30',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  waterButtonSecondary: {
    backgroundColor: OrialColors.surface,
  },
  waterButtonText: {
    color: OrialColors.cyan,
    fontWeight: '600',
  },
  waterButtonSecondaryText: {
    color: OrialColors.textSecondary,
  },
  nutritionCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  sodiumBadge: {
    backgroundColor: OrialColors.warning + '20',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  sodiumText: {
    color: OrialColors.warning,
    fontSize: 12,
  },
  activityCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItem: {
    alignItems: 'center',
    flex: 1,
  },
  supplementCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
  },
  supplementRow: {
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
  supplementButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  supplementPending: {
    backgroundColor: OrialColors.violet + '30',
  },
  supplementTaken: {
    backgroundColor: OrialColors.success + '20',
  },
  supplementButtonText: {
    color: OrialColors.violetLight,
    fontWeight: '600',
  },
  supplementTakenText: {
    color: OrialColors.success,
  },
  predictionCard: {
    margin: 16,
    marginTop: 0,
    padding: 16,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  predictionInfo: {
    flex: 1,
  },
  rangeBar: {
    marginBottom: 12,
  },
  rangeTrack: {
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rangeFill: {
    height: '100%',
    backgroundColor: OrialColors.cyan,
    borderRadius: 3,
    width: '100%',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  factorsContainer: {
    marginTop: 8,
  },
  factorsTitle: {
    marginBottom: 4,
    fontWeight: '600',
  },
  factorItem: {
    marginBottom: 2,
    color: OrialColors.textSecondary,
  },
  macroMiniBars: {
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  macroMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroMiniLabel: {
    width: 50,
    color: OrialColors.textSecondary,
    fontSize: 11,
  },
  macroMiniTrack: {
    flex: 1,
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  macroMiniFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroMiniValue: {
    width: 40,
    textAlign: 'right',
    color: OrialColors.textMuted,
    fontSize: 11,
  },
  macroDetailLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
});

function MacroMiniBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  return (
    <View style={styles.macroMiniRow}>
      <Text style={styles.macroMiniLabel}>{label}</Text>
      <View style={styles.macroMiniTrack}>
        <View style={[styles.macroMiniFill, { width: `${(pct * 100).toFixed(0)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.macroMiniValue}>{current}g/{goal}g</Text>
    </View>
  );
}
