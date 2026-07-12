import { NativeModules, Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { whoopService } from './whoopService';
import { pedometerService } from './pedometerService';
import { hydrationService } from './hydrationService';
import { supplementService } from './supplementService';
import { weightPredictionService } from './weightPredictionService';
import { db } from './database';
import { bodyMetrics } from '../../drizzle/schema';
import { desc } from 'drizzle-orm';
import { writeHydrationBaseline } from './nfcWaterQueue';

const SHARED_PREFS_NAME = 'orial_widget_data';
const GROUP_ID = 'group.com.orial.app.widget';

export interface ForgeWidgetData {
  date: string;
  steps: number;
  caloriesBurned: number | null;
  recoveryScore: number | null;
  strain: number | null;
  whoopConnected: boolean;
  weight: number | null;
}

export interface PhysicalWidgetData {
  date: string;
  hydrationCurrent: number;
  hydrationTarget: number;
  hydrationPercentage: number;
  supplementsPending: number;
  supplementsTotal: number;
  predictedWeight: number | null;
  weightRangeLow: number | null;
  weightRangeHigh: number | null;
}

export class WidgetService {
  private static instance: WidgetService;

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  async updateWidgetData(): Promise<void> {
    try {
      if (!DefaultPreference) {
        console.warn('DefaultPreference native module not available');
        return;
      }

      // Fetch Forge data
      const whoopConnected = await whoopService.isConnected();
      const todayMetrics = whoopConnected ? await whoopService.getTodayMetrics() : null;
      const steps = await pedometerService.getTodaySteps();

      // Get latest weight from DB
      const weightEntries = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date)).limit(1);
      const latestWeight = weightEntries[0]?.weightKg ?? null;

      const forgeData: ForgeWidgetData = {
        date: new Date().toISOString(),
        steps,
        caloriesBurned: todayMetrics?.kilojoule ? Math.round(todayMetrics.kilojoule / 4.184) : null,
        recoveryScore: todayMetrics?.recoveryScore ?? null,
        strain: todayMetrics?.strain ?? null,
        whoopConnected,
        weight: latestWeight,
      };

      // Fetch Physical data
      const today = new Date().toISOString().split('T')[0];
      const hydrationProgress = await hydrationService.getProgress(today);

      await writeHydrationBaseline(today, hydrationProgress.consumedLiters);

      const supplementLogs = await supplementService.getTodayLogs(today);
      const prediction = await weightPredictionService.getTodayPrediction();

      const pendingSupplements = supplementLogs.filter(l => !l.takenAt).length;

      const physicalData: PhysicalWidgetData = {
        date: new Date().toISOString(),
        hydrationCurrent: hydrationProgress.current,
        hydrationTarget: hydrationProgress.target,
        hydrationPercentage: hydrationProgress.percentage,
        supplementsPending: pendingSupplements,
        supplementsTotal: supplementLogs.length,
        predictedWeight: prediction?.predictedWeightKg ?? null,
        weightRangeLow: prediction?.predictionRangeLow ?? null,
        weightRangeHigh: prediction?.predictionRangeHigh ?? null,
      };

      // Save to shared preferences for widgets
      if (Platform.OS === 'ios') {
        // iOS: Use App Groups via DefaultPreference
        await DefaultPreference.setName(GROUP_ID);
        await DefaultPreference.set('forge_widget_data', JSON.stringify(forgeData));
        await DefaultPreference.set('physical_widget_data', JSON.stringify(physicalData));
      } else {
        // Android: Use SharedPreferences
        await DefaultPreference.setName(SHARED_PREFS_NAME);
        await DefaultPreference.set('forge_widget_data', JSON.stringify(forgeData));
        await DefaultPreference.set('physical_widget_data', JSON.stringify(physicalData));
      }

      // Reload widgets
      this.reloadWidgets();
    } catch (error) {
      console.error('Error updating widget data:', error);
    }
  }

  private reloadWidgets(): void {
    if (Platform.OS === 'ios') {
      // On iOS, widgets auto-update when timeline reloads
      // We can force reload via NativeModules if needed
      try {
        const { WidgetManager } = NativeModules;
        if (WidgetManager?.reloadAllTimelines) {
          WidgetManager.reloadAllTimelines();
        }
      } catch {
        // WidgetManager not available
      }
    }
    // On Android, widgets update via broadcast or on their own schedule
  }
}

export const widgetService = WidgetService.getInstance();
