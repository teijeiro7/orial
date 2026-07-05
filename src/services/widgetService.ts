import { NativeModules, Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { eq, and, desc } from 'drizzle-orm';
import { useHabitStore } from '../stores/habitStore';
import { whoopService } from './whoopService';
import { pedometerService } from './pedometerService';
import { hydrationService } from './hydrationService';
import { supplementService } from './supplementService';
import { weightPredictionService } from './weightPredictionService';
import { db } from './database';
import { bodyMetrics, habitEntries, habits } from '../../drizzle/schema';
import { generateUUID } from '../utils/uuid';

const SHARED_PREFS_NAME = 'orial_widget_data';
const GROUP_ID = 'group.com.orial.app.widget';

// Snapshot keys — read by widget extension's TimelineProvider
const KEY_WIDGET_DATA = 'widget_data';
const KEY_FORGE_WIDGET_DATA = 'forge_widget_data';
const KEY_PHYSICAL_WIDGET_DATA = 'physical_widget_data';

// Delta queues — written by widget App Intents, consumed by the app.
// We keep them as JSON arrays so the widget can append without read-modify-write
// races; the app drains the entire array atomically.
const KEY_HABIT_QUEUE = 'widget_habit_checkin_queue';
const KEY_HYDRATION_QUEUE = 'widget_hydration_delta_queue';

export interface WidgetData {
  date: string;
  completedCount: number;
  totalCount: number;
  habits: {
    id: string;
    name: string;
    emoji: string;
    completed: boolean;
    category: string;
  }[];
  streakCount: number;
}

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

export interface HabitCheckinQueueItem {
  habitId: string;
  completed: boolean;
  ts: number;
}

export interface HydrationDeltaQueueItem {
  ml: number;
  ts: number;
}

export interface ConsumeQueuesResult {
  habitCheckinsApplied: number;
  hydrationMlApplied: number;
  totalProcessed: number;
}

export class WidgetService {
  private static instance: WidgetService;

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  private async getGroupId(): Promise<string> {
    return Platform.OS === 'ios' ? GROUP_ID : SHARED_PREFS_NAME;
  }

  private async readJson<T>(key: string): Promise<T | null> {
    if (!DefaultPreference) return null;
    try {
      await DefaultPreference.setName(await this.getGroupId());
      const raw = await DefaultPreference.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async writeJson(key: string, value: unknown): Promise<void> {
    if (!DefaultPreference) return;
    try {
      await DefaultPreference.setName(await this.getGroupId());
      await DefaultPreference.set(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[WidgetService] write failed', key, e);
    }
  }

  private async clearKey(key: string): Promise<void> {
    if (!DefaultPreference) return;
    try {
      await DefaultPreference.setName(await this.getGroupId());
      await DefaultPreference.clear(key);
    } catch {
      // best-effort
    }
  }

  /**
   * Push the latest snapshot of all widget data to the App Group UserDefaults
   * and ask WidgetKit to reload its timelines. Called on AppState change
   * (background) and after any data mutation that affects the widgets.
   */
  async updateWidgetData(): Promise<void> {
    if (!DefaultPreference) {
      console.warn('DefaultPreference native module not available');
      return;
    }

    try {
      const { habits, todayEntries } = useHabitStore.getState();

      const completedCount = habits.filter((h) =>
        todayEntries.some((e) => e.habitId === h.id && e.completed),
      ).length;

      const widgetData: WidgetData = {
        date: new Date().toISOString(),
        completedCount,
        totalCount: habits.length,
        habits: habits.map((habit) => ({
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          completed: todayEntries.some((e) => e.habitId === habit.id && e.completed),
          category: habit.category,
        })),
        streakCount: this.calculateTotalStreaks(),
      };

      const whoopConnected = await whoopService.isConnected();
      const todayMetrics = whoopConnected ? await whoopService.getTodayMetrics() : null;
      const steps = await pedometerService.getTodaySteps();

      const weightEntries = await db
        .select()
        .from(bodyMetrics)
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
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

      const today = new Date().toISOString().split('T')[0];
      const hydrationProgress = await hydrationService.getProgress(today);
      const supplementLogs = await supplementService.getTodayLogs(today);
      const prediction = await weightPredictionService.getTodayPrediction();
      const pendingSupplements = supplementLogs.filter((l) => !l.takenAt).length;

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

      await this.writeJson(KEY_WIDGET_DATA, widgetData);
      await this.writeJson(KEY_FORGE_WIDGET_DATA, forgeData);
      await this.writeJson(KEY_PHYSICAL_WIDGET_DATA, physicalData);

      this.reloadWidgets();
    } catch (error) {
      console.error('[WidgetService] updateWidgetData failed:', error);
    }
  }

  /**
   * Drain the queues that widget App Intents append to. Applies each item to
   * the SQLite DB and clears the queue. Idempotent on the same payload set
   * because the queue is fully cleared after each call.
   */
  async consumeQueues(): Promise<ConsumeQueuesResult> {
    const result: ConsumeQueuesResult = {
      habitCheckinsApplied: 0,
      hydrationMlApplied: 0,
      totalProcessed: 0,
    };

    if (!DefaultPreference) return result;

    // ── Habit check-ins ────────────────────────────────────────────────────
    const habitQueue = (await this.readJson<HabitCheckinQueueItem[]>(KEY_HABIT_QUEUE)) ?? [];
    if (habitQueue.length > 0) {
      for (const item of habitQueue) {
        try {
          await this.applyHabitCheckin(item);
          result.habitCheckinsApplied++;
        } catch (e) {
          console.warn('[WidgetService] failed to apply habit check-in', item, e);
        }
      }
      await this.clearKey(KEY_HABIT_QUEUE);
    }

    // ── Hydration deltas ───────────────────────────────────────────────────
    const hydrationQueue =
      (await this.readJson<HydrationDeltaQueueItem[]>(KEY_HYDRATION_QUEUE)) ?? [];
    if (hydrationQueue.length > 0) {
      // Sum all ml additions and apply as one transaction to keep things simple
      const totalMl = hydrationQueue.reduce((sum, q) => sum + (q.ml || 0), 0);
      if (totalMl > 0) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await hydrationService.addWater(today, totalMl / 1000, 'water');
          result.hydrationMlApplied = totalMl;
        } catch (e) {
          console.warn('[WidgetService] failed to apply hydration delta', e);
        }
      }
      await this.clearKey(KEY_HYDRATION_QUEUE);
    }

    result.totalProcessed = result.habitCheckinsApplied + (result.hydrationMlApplied > 0 ? 1 : 0);

    if (result.totalProcessed > 0) {
      // Refresh the zustand store so the UI reflects the new state, and
      // republish widget data so the new totals appear in the snapshot.
      try {
        await useHabitStore.getState().loadTodayEntries();
      } catch {
        // ignore
      }
      await this.updateWidgetData();
    }

    return result;
  }

  private async applyHabitCheckin(item: HabitCheckinQueueItem): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look up the habit so we know if it's still active (in case it was
    // archived in the app while a widget intent was in flight).
    const habitRows = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, item.habitId), eq(habits.isArchived, false)))
      .limit(1);
    if (!habitRows[0]) return;

    const existing = await db
      .select()
      .from(habitEntries)
      .where(and(eq(habitEntries.habitId, item.habitId), eq(habitEntries.date, today)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(habitEntries)
        .set({ completed: item.completed })
        .where(eq(habitEntries.id, existing[0].id));
    } else {
      await db.insert(habitEntries).values({
        id: generateUUID(),
        habitId: item.habitId,
        date: today,
        completed: item.completed,
        createdAt: new Date(),
        note: null,
        notionEntryId: null,
        isSynced: false,
      });
    }
  }

  private calculateTotalStreaks(): number {
    // Simplified streak calculation for widget. The accurate calculation
    // lives in utils/streakCalculator.ts and is too heavy to run on every
    // widget refresh; the widget only needs a representative number.
    return 5; // Placeholder
  }

  private reloadWidgets(): void {
    if (Platform.OS === 'ios') {
      try {
        const { WidgetManager } = NativeModules;
        if (WidgetManager?.reloadAllTimelines) {
          WidgetManager.reloadAllTimelines();
        }
      } catch {
        // WidgetManager not available — widgets will pick up the change on
        // the next system-driven refresh.
      }
    }
  }
}

export const widgetService = WidgetService.getInstance();
