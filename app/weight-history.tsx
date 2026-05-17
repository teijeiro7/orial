import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { TrendingDown, Scale, Calendar, ChevronRight } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { weightPredictionService } from '@/src/services/weightPredictionService';
import { manualMetricsService } from '@/src/services/manualMetricsService';
import Svg, { Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import type { WeightPrediction } from '@/drizzle/schema';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_PADDING = 40;
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;

export default function WeightHistoryScreen() {
  const [predictions, setPredictions] = useState<WeightPrediction[]>([]);
  const [accuracy, setAccuracy] = useState({ mae: 0, withinRange: 0, total: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [history, acc] = await Promise.all([
      weightPredictionService.getHistory(30),
      weightPredictionService.getAccuracy(30),
    ]);
    setPredictions(history);
    setAccuracy(acc);
  };

  const renderChart = () => {
    if (predictions.length < 2) return null;

    const withActual = predictions.filter(p => p.actualWeightKg);
    if (withActual.length < 2) return null;

    const weights = withActual.map(p => p.actualWeightKg!);
    const minWeight = Math.min(...weights) - 0.5;
    const maxWeight = Math.max(...weights) + 0.5;
    const weightRange = maxWeight - minWeight;

    const points = withActual.map((p, index) => {
      const x = CHART_PADDING + (index / (withActual.length - 1)) * (CHART_WIDTH - CHART_PADDING * 2);
      const y = CHART_HEIGHT - CHART_PADDING - ((p.actualWeightKg! - minWeight) / weightRange) * (CHART_HEIGHT - CHART_PADDING * 2);
      return { x, y, weight: p.actualWeightKg!, date: p.date };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <GlassCard style={styles.chartCard}>
        <Text style={[OrialTypography.headingSmall, styles.chartTitle]}>Weight Trend (30 days)</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <Line
              key={`grid-${i}`}
              x1={CHART_PADDING}
              y1={CHART_PADDING + ratio * (CHART_HEIGHT - CHART_PADDING * 2)}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={CHART_PADDING + ratio * (CHART_HEIGHT - CHART_PADDING * 2)}
              stroke={OrialColors.glassBorder}
              strokeWidth="1"
            />
          ))}

          {/* Weight line */}
          <Line
            x1={points[0]?.x || 0}
            y1={points[0]?.y || 0}
            x2={points[points.length - 1]?.x || 0}
            y2={points[points.length - 1]?.y || 0}
            stroke={OrialColors.cyan}
            strokeWidth="2"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={OrialColors.cyan}
            />
          ))}

          {/* Y-axis labels */}
          <SvgText x="5" y={CHART_PADDING} fill={OrialColors.textMuted} fontSize="10">{maxWeight.toFixed(1)}kg</SvgText>
          <SvgText x="5" y={CHART_HEIGHT - CHART_PADDING} fill={OrialColors.textMuted} fontSize="10">{minWeight.toFixed(1)}kg</SvgText>
        </Svg>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Weight History</Text>
          <Text style={OrialTypography.caption}>Track your weight and predictions</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Scale size={24} color={OrialColors.cyan} />
            <Text style={OrialTypography.headingMedium}>{accuracy.mae.toFixed(2)}kg</Text>
            <Text style={OrialTypography.caption}>Avg Error</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <TrendingDown size={24} color={OrialColors.success} />
            <Text style={OrialTypography.headingMedium}>{accuracy.total > 0 ? Math.round((accuracy.withinRange / accuracy.total) * 100) : 0}%</Text>
            <Text style={OrialTypography.caption}>In Range</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <Calendar size={24} color={OrialColors.violetLight} />
            <Text style={OrialTypography.headingMedium}>{accuracy.total}</Text>
            <Text style={OrialTypography.caption}>Days Tracked</Text>
          </GlassCard>
        </View>

        {/* Chart */}
        {renderChart()}

        {/* Daily List */}
        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Daily Records</Text>
          
          {predictions.slice().reverse().map((prediction) => (
            <GlassCard key={prediction.date} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={OrialTypography.bodyMedium}>
                  {new Date(prediction.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
                {prediction.actualWeightKg && (
                  <View style={styles.accuracyBadge}>
                    <Text style={[OrialTypography.caption, styles.accuracyText]}>
                      {prediction.predictionRangeLow && prediction.predictionRangeHigh &&
                        prediction.actualWeightKg >= prediction.predictionRangeLow &&
                        prediction.actualWeightKg <= prediction.predictionRangeHigh
                        ? 'In Range'
                        : 'Off Range'
                      }
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.weightRow}>
                <View style={styles.weightItem}>
                  <Text style={OrialTypography.caption}>Predicted</Text>
                  <Text style={OrialTypography.headingSmall}>{prediction.predictedWeightKg?.toFixed(2) || '--'} kg</Text>
                </View>
                
                <View style={styles.weightItem}>
                  <Text style={OrialTypography.caption}>Actual</Text>
                  <Text style={[OrialTypography.headingSmall, { 
                    color: prediction.actualWeightKg ? OrialColors.success : OrialColors.textMuted 
                  }]}>
                    {prediction.actualWeightKg?.toFixed(2) || '--'} kg
                  </Text>
                </View>
                
                <View style={styles.weightItem}>
                  <Text style={OrialTypography.caption}>Delta</Text>
                  <Text style={[OrialTypography.headingSmall, { 
                    color: (prediction.predictedDeltaKg || 0) >= 0 ? OrialColors.error : OrialColors.success 
                  }]}>
                    {(prediction.predictedDeltaKg || 0) > 0 ? '+' : ''}{(prediction.predictedDeltaKg || 0).toFixed(2)} kg
                  </Text>
                </View>
              </View>

              {prediction.factors && (
                <View style={styles.factorsContainer}>
                  {JSON.parse(prediction.factors).map((factor: string, index: number) => (
                    <Text key={index} style={[OrialTypography.caption, styles.factorItem]}>
                      • {factor}
                    </Text>
                  ))}
                </View>
              )}
            </GlassCard>
          ))}
        </View>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
  },
  chartCard: {
    margin: 16,
    padding: 16,
    alignItems: 'center',
  },
  chartTitle: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dayCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  accuracyBadge: {
    backgroundColor: OrialColors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accuracyText: {
    color: OrialColors.success,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weightItem: {
    alignItems: 'center',
    flex: 1,
  },
  factorsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: OrialColors.glassBorder,
  },
  factorItem: {
    marginBottom: 2,
    color: OrialColors.textSecondary,
  },
});
