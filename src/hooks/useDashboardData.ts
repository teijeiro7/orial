import { useCallback, useEffect, useState } from 'react';
import { calculatePeakState } from '@/src/services/peakStateService';
import type { PeakStateResult } from '@/src/services/peakStateService';
import { whoopService } from '@/src/services/whoopService';
import { hydrationService } from '@/src/services/hydrationService';
import type { HydrationTargetBreakdown } from '@/src/services/hydrationProfileService';
import { supplementService } from '@/src/services/supplementService';
import { manualMetricsService } from '@/src/services/manualMetricsService';
import { weightPredictionService } from '@/src/services/weightPredictionService';
import { nutritionService } from '@/src/services/nutritionService';
import { useNfcWaterQueueDrain } from '@/src/hooks/useNfcWaterQueueDrain';
import { todayDateString } from '@/src/utils/date';
import type { WhoopDaily, ManualMetric, WeightPrediction, NutritionLog } from '../../drizzle/schema';

const WHOOP_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export type DashboardSupplement = {
  supplementId: string;
  name: string;
  dailyDoseMg: number;
  takenAt: Date | null;
  streak: number;
};

/**
 * All data-fetching and business logic for the Dashboard screen: WHOOP sync,
 * hydration, supplements, manual metrics, weight prediction, nutrition, and
 * peak-state. Screen-only concerns (navigation, icon/color mapping, JSX)
 * stay in the screen component.
 */
export function useDashboardData() {
  const [refreshing, setRefreshing] = useState(false);
  const [whoopData, setWhoopData] = useState<WhoopDaily | null>(null);
  const [isWhoopConnected, setIsWhoopConnected] = useState(false);
  const [hydrationData, setHydrationData] = useState<{ current: number; target: number; percentage: number }>({
    current: 0,
    target: 3,
    percentage: 0,
  });
  const [hydrationBreakdown, setHydrationBreakdown] = useState<HydrationTargetBreakdown | null>(null);
  const [supplements, setSupplements] = useState<DashboardSupplement[]>([]);
  const [manualData, setManualData] = useState<ManualMetric | null>(null);
  const [prediction, setPrediction] = useState<WeightPrediction | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionLog | null>(null);
  const [peakState, setPeakState] = useState<PeakStateResult | null>(null);

  const loadAllData = useCallback(async () => {
    try {
      const today = todayDateString();
      const connected = await whoopService.isConnected();
      if (connected) await whoopService.syncToday();
      // Recalculate today's target first so it reflects any hydration profile
      // changes (weight/age/training/caffeine/stimulants) before reading progress.
      await hydrationService.recalculateTarget(today);
      const [whoop, hyd, breakdown, allSupps, manual, pred, nutrition, todayLogs] = await Promise.all([
        whoopService.getTodayMetrics(),
        hydrationService.getProgress(),
        hydrationService.getTargetBreakdown(),
        supplementService.getSupplements(),
        manualMetricsService.getTodayMetrics(),
        weightPredictionService.getTodayPrediction(),
        nutritionService.getTodayNutrition(),
        supplementService.getTodayLogs(today),
      ]);
      setIsWhoopConnected(connected);
      setWhoopData(whoop);
      if (whoop) setPeakState(calculatePeakState(whoop));
      setHydrationData(hyd);
      setHydrationBreakdown(breakdown);
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
  }, []);

  const loadWhoopData = useCallback(async () => {
    try {
      const connected = await whoopService.isConnected();
      if (connected) await whoopService.syncToday();
      const whoop = await whoopService.getTodayMetrics();
      setIsWhoopConnected(connected);
      setWhoopData(whoop);
    } catch (error) {
      console.error('Error syncing WHOOP:', error);
    }
  }, []);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadWhoopData, WHOOP_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAllData, loadWhoopData]);

  // Refetch dashboard data (including hydration) when the app returns to the
  // foreground, after any NFC water queue entries have been drained. The
  // in-flight guard in drainNfcWaterQueue makes it safe to call this alongside
  // _layout.tsx's own drain call on the same AppState 'active' event -- both
  // resolve to the same underlying drain.
  useNfcWaterQueueDrain(loadAllData);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const addWater = useCallback(async (
    liters: number,
    beverageType?: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other',
  ) => {
    const today = todayDateString();
    await hydrationService.addWater(today, liters, beverageType);
    const progress = await hydrationService.getProgress(today);
    setHydrationData(progress);
  }, []);

  const logSupplement = useCallback(async (supplementId: string) => {
    const today = todayDateString();
    const supp = supplements.find((s) => s.supplementId === supplementId);
    if (!supp) return;
    await supplementService.logSupplement(supplementId, today, supp.dailyDoseMg);
    setSupplements((prev) => prev.map((s) =>
      s.supplementId === supplementId ? { ...s, takenAt: new Date() } : s
    ));
  }, [supplements]);

  return {
    refreshing,
    whoopData,
    isWhoopConnected,
    hydrationData,
    hydrationBreakdown,
    supplements,
    manualData,
    prediction,
    nutritionData,
    peakState,
    onRefresh,
    addWater,
    logSupplement,
  };
}
