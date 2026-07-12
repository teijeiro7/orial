import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Flame, Coffee, Pill, ChevronRight } from 'lucide-react-native';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { nutritionService } from '../../src/services/nutritionService';
import { caffeineService } from '../../src/services/caffeineService';
import { supplementService } from '../../src/services/supplementService';
import type { NutritionLog } from '../../drizzle/schema';
import type { ActiveCaffeine } from '../../src/services/caffeineService';

const CALORIE_GOAL = 2100;

export default function IntakeScreen() {
  const router = useRouter();
  const [nutritionData, setNutritionData] = useState<NutritionLog | null>(null);
  const [activeCaffeine, setActiveCaffeine] = useState<ActiveCaffeine | null>(null);
  const [supplementsTaken, setSupplementsTaken] = useState(0);
  const [supplementsTotal, setSupplementsTotal] = useState(0);

  const loadSummaries = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [nutrition, caffeine, supplementLogs] = await Promise.all([
        nutritionService.getTodayNutrition(),
        caffeineService.getActiveCaffeine(),
        supplementService.getTodayLogs(today),
      ]);
      setNutritionData(nutrition);
      setActiveCaffeine(caffeine);
      setSupplementsTotal(supplementLogs.length);
      setSupplementsTaken(supplementLogs.filter((log) => log.takenAt).length);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Intake" />
      <Text style={styles.dateLabel}>{format(new Date(), 'EEEE, MMMM d').toUpperCase()}</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.push('/macros')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.warning}>
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.warning + '20' }]}>
                  <Flame size={18} color={OrialColors.warning} />
                </View>
                <Text style={styles.moduleTitle}>Macros</Text>
              </View>
              <ChevronRight size={18} color={OrialColors.textMuted} />
            </View>
            {nutritionData ? (
              <Text style={styles.moduleSummary}>
                {nutritionData.totalCalories ?? 0} / {CALORIE_GOAL} kcal today
              </Text>
            ) : (
              <Text style={styles.moduleSummary}>No macros logged today</Text>
            )}
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => router.push('/caffeine')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.cyan}>
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.cyan + '20' }]}>
                  <Coffee size={18} color={OrialColors.cyan} />
                </View>
                <Text style={styles.moduleTitle}>Caffeine</Text>
              </View>
              <ChevronRight size={18} color={OrialColors.textMuted} />
            </View>
            <Text style={styles.moduleSummary}>
              {activeCaffeine ? `${Math.round(activeCaffeine.currentLevel)}mg active` : '--'}
            </Text>
          </GlassCard>
        </Pressable>

        <Pressable onPress={() => router.push('/supplements')}>
          <GlassCard style={styles.moduleCard} accentColor={OrialColors.violetLight}>
            <View style={styles.moduleTop}>
              <View style={styles.moduleTitleRow}>
                <View style={[styles.moduleIcon, { backgroundColor: OrialColors.violet + '20' }]}>
                  <Pill size={18} color={OrialColors.violetLight} />
                </View>
                <Text style={styles.moduleTitle}>Supplements</Text>
              </View>
              <ChevronRight size={18} color={OrialColors.textMuted} />
            </View>
            <Text style={styles.moduleSummary}>
              {supplementsTotal > 0 ? `${supplementsTaken}/${supplementsTotal} taken today` : 'No supplements set up'}
            </Text>
          </GlassCard>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
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
  moduleCard: { padding: 20, borderRadius: 22 },
  moduleTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  moduleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moduleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { fontSize: 15, fontWeight: '700', color: OrialColors.textPrimary, fontFamily: 'Inter-Bold' },
  moduleSummary: { fontSize: 13, color: OrialColors.textSecondary, fontFamily: 'Inter-Regular' },
});
