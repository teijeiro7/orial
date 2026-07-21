import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Utensils, Flame, TrendingUp, Droplets } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { nutritionService } from '@/src/services/nutritionService';
import { hermesNutritionService } from '@/src/services/hermesNutritionService';
import { manualMetricsService } from '@/src/services/manualMetricsService';
import type { NutritionLog } from '@/drizzle/schema';

export default function NutritionHistoryScreen() {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [averages, setAverages] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sodium: 0,
  });
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await loadData();
      const results = await hermesNutritionService.syncLast14Days();
      const failed = results.find(r => r.reason === 'error');
      if (failed) setSyncError(failed.error ?? 'Range sync failed');
      else setSyncError(null);
      await loadData();
    })();
  }, []);

  const loadData = async () => {
    const [nutritionLogs, summary] = await Promise.all([
      nutritionService.getHistory(14),
      manualMetricsService.getCaloriesSummary(14),
    ]);

    setLogs(nutritionLogs);
    setAverages({
      calories: summary.avgCaloriesIn,
      protein: summary.avgProtein,
      carbs: summary.avgCarbs,
      fat: summary.avgFat,
      sodium: summary.avgSodium,
    });
  };

  const macroColors = {
    protein: OrialColors.violetLight,
    carbs: OrialColors.categoryLearn,
    fat: OrialColors.categoryMind,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Nutrition History</Text>
          <Text style={OrialTypography.caption}>Track your nutrition from Hermes</Text>
        </View>

        {syncError && (
          <View style={styles.syncErrorBanner}>
            <Text style={styles.syncErrorText}>Hermes unreachable: {syncError}</Text>
          </View>
        )}

        {/* Averages */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Flame size={20} color={OrialColors.warning} />
            <Text style={OrialTypography.headingMedium}>{averages.calories.toFixed(0)}</Text>
            <Text style={OrialTypography.caption}>Avg Kcal</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <Utensils size={20} color={macroColors.protein} />
            <Text style={OrialTypography.headingMedium}>{averages.protein.toFixed(0)}g</Text>
            <Text style={OrialTypography.caption}>Avg Protein</Text>
          </GlassCard>
          
          <GlassCard style={styles.statCard}>
            <Droplets size={20} color={macroColors.carbs} />
            <Text style={OrialTypography.headingMedium}>{averages.carbs.toFixed(0)}g</Text>
            <Text style={OrialTypography.caption}>Avg Carbs</Text>
          </GlassCard>
        </View>

        {/* Macro Breakdown */}
        <GlassCard style={styles.macroCard}>
          <Text style={[OrialTypography.headingSmall, styles.macroTitle]}>14-Day Macro Averages</Text>
          
          <View style={styles.macroRow}>
            <View style={styles.macroLabel}>
              <View style={[styles.macroDot, { backgroundColor: macroColors.protein }]} />
              <Text style={OrialTypography.bodyMedium}>Protein</Text>
            </View>
            <Text style={OrialTypography.headingSmall}>{averages.protein.toFixed(1)}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroLabel}>
              <View style={[styles.macroDot, { backgroundColor: macroColors.carbs }]} />
              <Text style={OrialTypography.bodyMedium}>Carbs</Text>
            </View>
            <Text style={OrialTypography.headingSmall}>{averages.carbs.toFixed(1)}g</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={styles.macroLabel}>
              <View style={[styles.macroDot, { backgroundColor: macroColors.fat }]} />
              <Text style={OrialTypography.bodyMedium}>Fat</Text>
            </View>
            <Text style={OrialTypography.headingSmall}>{averages.fat.toFixed(1)}g</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.macroRow}>
            <Text style={OrialTypography.bodyMedium}>Sodium</Text>
            <Text style={OrialTypography.headingSmall}>{averages.sodium.toFixed(0)}mg</Text>
          </View>
        </GlassCard>

        {/* Daily List */}
        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Daily Records</Text>
          
          {logs.slice().reverse().map((log) => (
            <GlassCard key={log.date} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={OrialTypography.bodyMedium}>
                  {new Date(log.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
                <Text style={[OrialTypography.caption, styles.sourceBadge]}>{log.source}</Text>
              </View>
              
              <View style={styles.caloriesRow}>
                <Text style={OrialTypography.headingMedium}>{log.totalCalories || '--'}</Text>
                <Text style={OrialTypography.caption}> kcal</Text>
              </View>
              
              <View style={styles.macrosGrid}>
                <View style={styles.macroItem}>
                  <Text style={[OrialTypography.caption, { color: macroColors.protein }]}>Protein</Text>
                  <Text style={OrialTypography.bodyMedium}>{log.proteinG || '--'}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[OrialTypography.caption, { color: macroColors.carbs }]}>Carbs</Text>
                  <Text style={OrialTypography.bodyMedium}>{log.carbsG || '--'}g</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={[OrialTypography.caption, { color: macroColors.fat }]}>Fat</Text>
                  <Text style={OrialTypography.bodyMedium}>{log.fatG || '--'}g</Text>
                </View>
              </View>
              
              {log.sodiumMg && (
                <View style={styles.sodiumRow}>
                  <Text style={[OrialTypography.caption, styles.sodiumText]}>
                    Sodium: {log.sodiumMg}mg
                  </Text>
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
  macroCard: {
    margin: 16,
    padding: 16,
  },
  macroTitle: {
    marginBottom: 16,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  macroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: OrialColors.glassBorder,
    marginVertical: 12,
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
  sourceBadge: {
    backgroundColor: OrialColors.violet + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    color: OrialColors.violetLight,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  sodiumRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: OrialColors.glassBorder,
  },
  sodiumText: {
    color: OrialColors.warning,
  },
  syncErrorBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: OrialColors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OrialColors.error + '40',
  },
  syncErrorText: {
    fontSize: 11,
    color: OrialColors.error,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});
