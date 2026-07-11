import { and, gte, lte, desc } from 'drizzle-orm';
import { db } from './database';
import { caffeineLogs } from '../../drizzle/schema';
import type { CaffeineLog, NewCaffeineLog } from '../../drizzle/schema';
import { generateUUID } from '../utils/uuid';
import { formatHM } from '../utils/time';
import { notificationService } from './notificationService';
import {
  levelAt,
  computePeak,
  estimateClearAt,
  willInterfereWithSleep as calcWillInterfereWithSleep,
  buildTimeline,
  MS_PER_HOUR,
  SLEEP_INTERFERENCE_THRESHOLD_MG,
  DEFAULT_BEDTIME_HOUR,
  type CaffeineDose,
} from './caffeineCalc';

/** How far back we look for doses that could still be contributing to the current level. */
const ACTIVE_WINDOW_HOURS = 24;

/** Reference caffeine content (mg) for common sources — used by quick-add UI and defaults. */
export const CAFFEINE_REFERENCE_MG: Record<string, number> = {
  espresso: 63,
  filtered_coffee: 95,
  instant_coffee: 60,
  black_tea: 47,
  green_tea: 28,
  red_bull: 80,
  monster: 160,
  coca_cola: 34,
  pre_workout: 175, // midpoint of the 150-200mg range
  pill_100mg: 100,
};

export interface QuickSource {
  key: string;
  label: string;
  emoji: string;
  source: string;
  mg: number;
}

/** The quick-add shortcuts shown on the caffeine tab. */
export const QUICK_SOURCES: QuickSource[] = [
  { key: 'espresso', label: 'Espresso', emoji: '☕', source: 'coffee', mg: CAFFEINE_REFERENCE_MG.espresso },
  { key: 'black_tea', label: 'Té', emoji: '🫖', source: 'tea', mg: CAFFEINE_REFERENCE_MG.black_tea },
  { key: 'monster', label: 'Monster', emoji: '⚡', source: 'energy_drink', mg: CAFFEINE_REFERENCE_MG.monster },
  { key: 'pill_100mg', label: 'Pastilla', emoji: '💊', source: 'supplement', mg: CAFFEINE_REFERENCE_MG.pill_100mg },
];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toDoses(rows: CaffeineLog[]): CaffeineDose[] {
  return rows.map((row) => ({ mg: row.caffeineMg, timestampMs: row.timestamp.getTime() }));
}

export interface ActiveCaffeine {
  totalMg: number;
  peakAt: Date | null;
  peakMg: number | null;
  estimatedClearAt: Date | null;
  currentLevel: number;
}

export interface SleepInterferenceCheck {
  interfere: boolean;
  hoursBeforeBed: number;
  recommendation: string;
}

export interface DailyChart {
  logs: CaffeineLog[];
  timeline: { atMs: number; mg: number }[];
  total: number;
  peak: number;
}

export const caffeineService = {
  /**
   * Logs a caffeine dose and, if it would still put blood caffeine above the
   * interference threshold at the default bedtime, immediately fires the
   * "this may interfere with your sleep" alert via notificationService.
   */
  async logCaffeine(
    source: string,
    mg: number,
    timestamp: Date = new Date(),
    notes?: string,
    now: Date = new Date(),
  ): Promise<void> {
    const entry: NewCaffeineLog = {
      id: generateUUID(),
      source,
      caffeineMg: mg,
      timestamp,
      notes: notes ?? null,
      createdAt: now,
    };
    await db.insert(caffeineLogs).values(entry);
    await this.checkAndNotifySleepInterference(timestamp, now);
  },

  async getTodayLogs(now: Date = new Date()): Promise<CaffeineLog[]> {
    return db
      .select()
      .from(caffeineLogs)
      .where(and(gte(caffeineLogs.timestamp, startOfLocalDay(now)), lte(caffeineLogs.timestamp, endOfLocalDay(now))))
      .orderBy(desc(caffeineLogs.timestamp));
  },

  /** Doses from the last 24h that could still be contributing to the current blood level. */
  async getActiveDoses(now: Date = new Date()): Promise<CaffeineDose[]> {
    const windowStart = new Date(now.getTime() - ACTIVE_WINDOW_HOURS * MS_PER_HOUR);
    const rows = await db
      .select()
      .from(caffeineLogs)
      .where(and(gte(caffeineLogs.timestamp, windowStart), lte(caffeineLogs.timestamp, now)));
    return toDoses(rows);
  },

  async getActiveCaffeine(now: Date = new Date()): Promise<ActiveCaffeine> {
    const doses = await this.getActiveDoses(now);
    const peak = computePeak(doses);
    const clearAtMs = estimateClearAt(doses, now.getTime());

    return {
      totalMg: doses.reduce((sum, d) => sum + d.mg, 0),
      peakAt: peak ? new Date(peak.atMs) : null,
      peakMg: peak ? peak.mg : null,
      estimatedClearAt: clearAtMs !== null ? new Date(clearAtMs) : null,
      currentLevel: levelAt(doses, now.getTime()),
    };
  },

  async willInterfereWithSleep(bedtime: Date, now: Date = new Date()): Promise<SleepInterferenceCheck> {
    const doses = await this.getActiveDoses(now);
    const { interfere, levelAtBedtimeMg } = calcWillInterfereWithSleep(
      doses,
      bedtime.getTime(),
      SLEEP_INTERFERENCE_THRESHOLD_MG,
    );
    const hoursBeforeBed = (bedtime.getTime() - now.getTime()) / MS_PER_HOUR;
    const recommendation = interfere
      ? `Tendrás ~${Math.round(levelAtBedtimeMg)}mg de cafeína en sangre a las ${formatHM(bedtime)}. Evita más cafeína a partir de ahora.`
      : 'No debería interferir con tu sueño.';

    return { interfere, hoursBeforeBed, recommendation };
  },

  async getDailyChart(date: Date = new Date()): Promise<DailyChart> {
    const dayStart = startOfLocalDay(date);
    const dayEnd = endOfLocalDay(date);
    const logs = await this.getTodayLogs(date);
    const doses = toDoses(logs);

    const timeline = buildTimeline(doses, dayStart.getTime(), dayEnd.getTime(), 30);
    const peak = computePeak(doses);

    return {
      logs,
      timeline,
      total: doses.reduce((sum, d) => sum + d.mg, 0),
      peak: peak ? peak.mg : 0,
    };
  },

  /** Default bedtime used for the automatic sleep-interference check until a user setting exists. */
  getDefaultBedtime(reference: Date = new Date()): Date {
    return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), DEFAULT_BEDTIME_HOUR, 0, 0, 0);
  },

  /** Fires the immediate sleep-interference alert if the just-logged dose crosses the threshold at bedtime. */
  async checkAndNotifySleepInterference(loggedAt: Date, now: Date = new Date()): Promise<void> {
    const bedtime = this.getDefaultBedtime(loggedAt >= now ? loggedAt : now);
    if (bedtime.getTime() <= now.getTime()) return; // bedtime already passed today, nothing to warn about

    const { interfere } = await this.willInterfereWithSleep(bedtime, now);
    if (!interfere) return;

    const doses = await this.getActiveDoses(now);
    const clearAtMs = estimateClearAt(doses, now.getTime());
    const clearAt = clearAtMs !== null ? new Date(clearAtMs) : bedtime;
    await notificationService.scheduleCaffeineSleepInterferenceAlert(loggedAt, clearAt, bedtime);
  },

  /**
   * Schedules (or cancels) the 20:00 "you haven't logged caffeine today" nudge.
   * Meant to be called once when the caffeine tab loads.
   */
  async evaluateDailyCheckInReminder(now: Date = new Date()): Promise<void> {
    const todayLogs = await this.getTodayLogs(now);
    if (todayLogs.length === 0) {
      await notificationService.scheduleCaffeineCheckInReminder();
    } else {
      await notificationService.cancelCaffeineCheckInReminder();
    }
  },
};
