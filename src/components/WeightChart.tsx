import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';

interface WeightChartProps {
  data: { date: string; weight: number }[];
}

export function WeightChart({ data }: WeightChartProps) {
  if (data.length === 0) return null;

  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  // Take last 14 entries max
  const chartData = data.slice(-14);

  return (
    <View style={styles.container}>
      <View style={styles.chartArea}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{max.toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{((max + min) / 2).toFixed(1)}</Text>
          <Text style={styles.axisLabel}>{min.toFixed(1)}</Text>
        </View>

        {/* Bars */}
        <View style={styles.barsContainer}>
          {chartData.map((point, index) => {
            const height = ((point.weight - min) / range) * 100;
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={[styles.bar, { height: `${Math.max(height, 5)}%` }]} />
                <Text style={styles.barLabel}>{point.date.slice(5)}</Text>
              </View>
            );
          })}\n        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  chartArea: {
    flexDirection: 'row',
    height: 150,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  axisLabel: {
    ...OrialTypography.caption,
    fontSize: 10,
    color: OrialColors.textMuted,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: '80%',
    backgroundColor: OrialColors.cyan,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    ...OrialTypography.caption,
    fontSize: 9,
    color: OrialColors.textMuted,
    marginTop: 4,
    transform: [{ rotate: '-45deg' }],
    position: 'absolute',
    bottom: -16,
  },
});
