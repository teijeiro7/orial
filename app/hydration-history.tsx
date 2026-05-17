import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Droplets, TrendingUp, Calendar } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { hydrationService } from '@/src/services/hydrationService';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Hydration } from '@/drizzle/schema';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 180;
const BAR_WIDTH = 24;

export default function HydrationHistoryScreen() {
  const [history, setHistory] = useState<Hydration[]>([]);
  const [stats, setStats] = useState({
    avgIntake: 0,
    avgTarget: 0,
    bestDay: '',
    streak: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await hydrationService.getHistory(14);
    setHistory(data);

    if (data.length > 0) {
      const avgIntake = data.reduce((sum, h) => sum + (h.effectiveLiters || 0), 0) / data.length;
      const avgTarget = data.reduce((sum, h) => sum + (h.targetLiters || 3), 0) / data.length;
      
      const best = data.reduce((best, h) => 
        (h.effectiveLiters || 0) > (best.effectiveLiters || 0) ? h : best, data[0]);

      let streak = 0;
      for (let i = data.length - 1; i >= 0; i--) {
        if ((data[i].effectiveLiters || 0) >= (data[i].targetLiters || 3)) {
          streak++;
        } else {
          break;
        }
      }

      setStats({
        avgIntake,
        avgTarget,
        bestDay: best?.date || '',
        streak,
      });
    }
  };

  const renderChart = () => {
    if (history.length === 0) return null;

    const maxValue = Math.max(...history.map(h => h.targetLiters || 3), ...history.map(h => h.effectiveLiters || 0)) * 1.1;
    const barGap = (CHART_WIDTH - BAR_WIDTH * history.length) / (history.length + 1);

    return (
      <GlassCard style={styles.chartCard}>
        <Text style={[OrialTypography.headingSmall, styles.chartTitle]}>Hydration (14 days)</Text>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {/* Target line */}
          <Line
            x1="0"
            y1={CHART_HEIGHT - ((stats.avgTarget / maxValue) * CHART_HEIGHT)}
            x2={CHART_WIDTH}
            y2={CHART_HEIGHT - ((stats.avgTarget / maxValue) * CHART_HEIGHT)}
            stroke={OrialColors.warning}
            strokeWidth="1"
            strokeDasharray="4,4"
          />

          {history.map((day, index) => {
            const x = barGap + index * (BAR_WIDTH + barGap);
            const targetHeight = ((day.targetLiters || 3) / maxValue) * CHART_HEIGHT;
            const actualHeight = ((day.effectiveLiters || 0) / maxValue) * CHART_HEIGHT;
            const isMet = (day.effectiveLiters || 0) >= (day.targetLiters || 3);

            return (
              <React.Fragment key={day.date}>
                {/* Target bar (background) */}
                <Rect
                  x={x}
                  y={CHART_HEIGHT - targetHeight}
                  width={BAR_WIDTH}
                  height={targetHeight}
                  fill={OrialColors.glassBorder}
                  rx="4"
                />
                {/* Actual bar */}
                <Rect
                  x={x}
                  y={CHART_HEIGHT - actualHeight}
                  width={BAR_WIDTH}
                  height={actualHeight}
                  fill={isMet ? OrialColors.success : OrialColors.cyan}
                  rx="4"
                />
                {/* Day label */}
                <SvgText
                  x={x + BAR_WIDTH / 2}
                  y={CHART_HEIGHT + 12}
                  fill={OrialColors.textMuted}
                  fontSize="9"
                  textAnchor="middle"
                >
                  {new Date(day.date).getDate()}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Hydration History</Text>
          <Text style={OrialTypography.caption}>Track your water intake over time</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Droplets size={24} color={OrialColors.cyan} />
            <Text style={OrialTypography.headingMedium}>{stats.avgIntake.toFixed(2)}L</Text>
            <Text style={OrialTypography.caption}>Avg Daily</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <TrendingUp size={24} color={OrialColors.success} />
            <Text style={OrialTypography.headingMedium}>{stats.streak}</Text>
            <Text style={OrialTypography.caption}>Day Streak</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <Calendar size={24} color={OrialColors.violetLight} />
            <Text style={OrialTypography.headingMedium}>{stats.bestDay ? new Date(stats.bestDay).getDate() : '--'}</Text>
            <Text style={OrialTypography.caption}>Best Day</Text>
          </GlassCard>
        </View>

        {/* Chart */}
        {renderChart()}

        {/* Daily List */}
        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Daily Records</Text>
          
          {history.slice().reverse().map((day) => {
            const percentage = Math.round(((day.effectiveLiters || 0) / (day.targetLiters || 3)) * 100);
            const isMet = percentage >= 100;

            return (
              <GlassCard key={day.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={OrialTypography.bodyMedium}>
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </Text>
                  <View style={[
                    styles.percentageBadge,
                    isMet ? styles.metBadge : styles.unmetBadge
                  ]}>
                    <Text style={[
                      OrialTypography.caption,
                      isMet ? styles.metText : styles.unmetText
                    ]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>
                
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBar}>
                    <View style={[
                      styles.progressFill,
                      { 
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: isMet ? OrialColors.success : OrialColors.cyan
                      }
                    ]} />
                  </View>
                </View>
                
                <View style={styles.detailsRow}>
                  <Text style={OrialTypography.caption}>
                    {(day.effectiveLiters || 0).toFixed(2)}L / {(day.targetLiters || 3).toFixed(2)}L target
                  </Text>
                  <Text style={OrialTypography.caption}>
                    {day.consumedLiters?.toFixed(1) || 0}L consumed
                  </Text>
                </View>
              </GlassCard>
            );
          })}
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
    marginBottom: 8,
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metBadge: {
    backgroundColor: OrialColors.success + '20',
  },
  unmetBadge: {
    backgroundColor: OrialColors.cyan + '20',
  },
  metText: {
    color: OrialColors.success,
  },
  unmetText: {
    color: OrialColors.cyan,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
