import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { TrendingDown, Scale, Info, ArrowRight } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { weightPredictionService } from '@/src/services/weightPredictionService';
import { manualMetricsService } from '@/src/services/manualMetricsService';
import { whoopService } from '@/src/services/whoopService';
import { hydrationService } from '@/src/services/hydrationService';
import { todayDateString } from '@/src/utils/date';
import type { WeightPrediction } from '@/drizzle/schema';

export default function PredictionDetailScreen() {
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);
  const [metrics, setMetrics] = useState({
    caloriesIn: null as number | null,
    caloriesBurned: null as number | null,
    sodiumMg: null as number | null,
    carbsG: null as number | null,
    fiberG: null as number | null,
    hydrationDelta: null as number | null,
    sleepPerformance: null as number | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const today = todayDateString();
    
    const [pred, manual, whoop, hyd] = await Promise.all([
      weightPredictionService.getTodayPrediction(),
      manualMetricsService.getTodayMetrics(),
      whoopService.getTodayMetrics(),
      hydrationService.getProgress(today),
    ]);

    setPrediction(pred);
    
    if (manual || whoop || hyd) {
      setMetrics({
        caloriesIn: manual?.caloriesIn || null,
        caloriesBurned: whoop?.kilojoule ? Math.round(whoop.kilojoule * 0.239) : null,
        sodiumMg: manual?.sodiumMg || null,
        carbsG: manual?.carbsG || null,
        fiberG: manual?.fiberG || null,
        hydrationDelta: hyd ? (hyd.current - hyd.target) : null,
        sleepPerformance: whoop?.sleepPerformance || null,
      });
    }
  };

  const factors = prediction?.factors ? JSON.parse(prediction.factors) : [];

  const renderFactorCard = (
    title: string,
    value: string,
    description: string,
    icon: React.ReactNode,
    color: string
  ) => (
    <GlassCard style={styles.factorCard}>
      <View style={styles.factorHeader}>
        <View style={[styles.factorIcon, { backgroundColor: color + '20' }]} >
          {icon}
        </View>
        <View style={styles.factorTitle}>
          <Text style={OrialTypography.bodyMedium}>{title}</Text>
          <Text style={[OrialTypography.headingSmall, { color }]} >{value}</Text>
        </View>
      </View>
      <Text style={[OrialTypography.caption, styles.factorDescription]}>{description}</Text>
    </GlassCard>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Weight Prediction</Text>
          <Text style={OrialTypography.caption}>How your weight is calculated</Text>
        </View>

        {/* Main Prediction */}
        {prediction && (
          <GlassCard style={styles.mainCard}>
            <View style={styles.predictionHeader}>
              <Scale size={32} color={OrialColors.cyan} />
              <View style={styles.predictionMain}>
                <Text style={OrialTypography.headingLarge}>
                  {prediction.predictedWeightKg?.toFixed(2)} kg
                </Text>
                <Text style={OrialTypography.caption}>Predicted for tomorrow</Text>
              </View>
            </View>

            {prediction.predictionRangeLow && prediction.predictionRangeHigh && (
              <View style={styles.rangeContainer}>
                <View style={styles.rangeBar}>
                  <View style={styles.rangeTrack}>
                    <View style={styles.rangeFill} />
                  </View>
                </View>
                <View style={styles.rangeLabels}>
                  <Text style={OrialTypography.caption}>{prediction.predictionRangeLow.toFixed(2)}kg</Text>
                  <Text style={[OrialTypography.caption, styles.confidenceText]}>
                    {(prediction.confidence || 0) * 100}% confidence
                  </Text>
                  <Text style={OrialTypography.caption}>{prediction.predictionRangeHigh.toFixed(2)}kg</Text>
                </View>
              </View>
            )}

            {prediction.predictedDeltaKg && (
              <View style={styles.deltaContainer}>
                <TrendingDown 
                  size={20} 
                  color={prediction.predictedDeltaKg >= 0 ? OrialColors.error : OrialColors.success} 
                />
                <Text style={[
                  OrialTypography.headingSmall,
                  { color: prediction.predictedDeltaKg >= 0 ? OrialColors.error : OrialColors.success }
                ]}>
                  {prediction.predictedDeltaKg > 0 ? '+' : ''}{prediction.predictedDeltaKg.toFixed(2)} kg
                </Text>
                <Text style={OrialTypography.caption}> expected change</Text>
              </View>
            )}
          </GlassCard>
        )}

        {/* Input Data */}
        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Today's Data</Text>

          {renderFactorCard(
            'Caloric Balance',
            metrics.caloriesIn && metrics.caloriesBurned
              ? `${metrics.caloriesBurned - metrics.caloriesIn} kcal`
              : 'No data',
            metrics.caloriesIn && metrics.caloriesBurned
              ? `Burned: ${metrics.caloriesBurned} kcal | Consumed: ${metrics.caloriesIn} kcal`
              : 'Connect Whoop and log nutrition to see caloric impact',
            <Info size={20} color={OrialColors.warning} />,
            OrialColors.warning
          )}

          {renderFactorCard(
            'Sodium Intake',
            metrics.sodiumMg ? `${metrics.sodiumMg} mg` : 'No data',
            metrics.sodiumMg
              ? `Extra water retention: +${(metrics.sodiumMg * 0.0015).toFixed(2)} kg expected`
              : 'Log sodium to see water retention impact',
            <Info size={20} color={OrialColors.categorySocial} />,
            OrialColors.categorySocial
          )}

          {renderFactorCard(
            'Carbohydrates',
            metrics.carbsG ? `${metrics.carbsG} g` : 'No data',
            metrics.carbsG
              ? `Glycogen/water impact: ${((metrics.carbsG - 200) / 1000 * 3.5).toFixed(2)} kg`
              : 'Log carbs to see glycogen impact',
            <Info size={20} color={OrialColors.categoryLearn} />,
            OrialColors.categoryLearn
          )}

          {renderFactorCard(
            'Hydration Status',
            metrics.hydrationDelta !== null
              ? `${metrics.hydrationDelta >= 0 ? '+' : ''}${metrics.hydrationDelta.toFixed(2)} L`
              : 'No data',
            metrics.hydrationDelta !== null
              ? `Weight impact: ${(metrics.hydrationDelta * 0.3).toFixed(2)} kg`
              : 'Track hydration to see water weight impact',
            <Info size={20} color={OrialColors.cyan} />,
            OrialColors.cyan
          )}

          {renderFactorCard(
            'Sleep Quality',
            metrics.sleepPerformance ? `${metrics.sleepPerformance}%` : 'No data',
            metrics.sleepPerformance
              ? `Weight adjustment: ${((metrics.sleepPerformance - 80) / 1000).toFixed(3)} kg`
              : 'Connect Whoop to see sleep impact',
            <Info size={20} color={OrialColors.violetLight} />,
            OrialColors.violetLight
          )}
        </View>

        {/* Factors Breakdown */}
        {factors.length > 0 && (
          <View style={styles.section}>
            <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Calculation Factors</Text>
            
            {factors.map((factor: string, index: number) => (
              <GlassCard key={index} style={styles.factorBreakdownCard}>
                <View style={styles.factorBreakdownRow}>
                  <View style={[styles.factorNumber, { backgroundColor: OrialColors.cyan + '20' }]}>
                    <Text style={[OrialTypography.caption, { color: OrialColors.cyan }]}>{index + 1}</Text>
                  </View>
                  <Text style={[OrialTypography.bodyMedium, styles.factorBreakdownText]}>{factor}</Text>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Info Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Info size={20} color={OrialColors.textMuted} />
            <Text style={[OrialTypography.headingSmall, styles.infoTitle]}>How it works</Text>
          </View>
          
          <Text style={[OrialTypography.caption, styles.infoText]}>
            The prediction model uses these constants based on Ruben's system:
          </Text>
          
          <View style={styles.constantsList}>
            <Text style={[OrialTypography.caption, styles.constantItem]}>• 7700 kcal = 1kg fat</Text>
            <Text style={[OrialTypography.caption, styles.constantItem]}>• 3.5g water per 1g glycogen</Text>
            <Text style={[OrialTypography.caption, styles.constantItem]}>• 0.0015kg retention per mg sodium</Text>
            <Text style={[OrialTypography.caption, styles.constantItem]}>• 2300mg sodium = +1L water needed</Text>
          </View>
        </GlassCard>
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
  mainCard: {
    margin: 16,
    padding: 20,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  predictionMain: {
    flex: 1,
  },
  rangeContainer: {
    marginTop: 8,
  },
  rangeBar: {
    marginBottom: 8,
  },
  rangeTrack: {
    height: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rangeFill: {
    height: '100%',
    backgroundColor: OrialColors.cyan,
    borderRadius: 4,
    width: '100%',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceText: {
    color: OrialColors.cyan,
  },
  deltaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: OrialColors.glassBorder,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  factorCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  factorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factorTitle: {
    flex: 1,
  },
  factorDescription: {
    color: OrialColors.textSecondary,
    marginTop: 4,
  },
  factorBreakdownCard: {
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 12,
  },
  factorBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factorBreakdownText: {
    flex: 1,
    color: OrialColors.textSecondary,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    marginBottom: 32,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    color: OrialColors.textSecondary,
  },
  infoText: {
    color: OrialColors.textMuted,
    marginBottom: 8,
  },
  constantsList: {
    gap: 4,
  },
  constantItem: {
    color: OrialColors.textSecondary,
  },
});
