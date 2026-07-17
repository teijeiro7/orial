import { db } from './database';
import { pedometerHistory, type NewPedometerEntry } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { dateString } from '../utils/date';

let Pedometer: typeof import('expo-sensors').Pedometer | null = null;
try {
  Pedometer = require('expo-sensors').Pedometer;
} catch {
  Pedometer = null;
}

export class PedometerService {
  private static instance: PedometerService;
  private subscription: { remove: () => void } | null = null;

  static getInstance(): PedometerService {
    if (!PedometerService.instance) {
      PedometerService.instance = new PedometerService();
    }
    return PedometerService.instance;
  }

  async isAvailable(): Promise<boolean> {
    if (!Pedometer) return false;
    try {
      return await Pedometer.isAvailableAsync();
    } catch {
      return false;
    }
  }

  async getStepsForDate(date: Date): Promise<number> {
    if (!(await this.isAvailable())) return 0;

    const dateKey = dateString(date);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    try {
      const result = await Pedometer!.getStepCountAsync(start, end);
      const steps = result?.steps || 0;

      await db.insert(pedometerHistory).values({
        date: dateKey,
        steps,
        updatedAt: new Date(),
      } as NewPedometerEntry).onConflictDoUpdate({
        target: pedometerHistory.date,
        set: { steps, updatedAt: new Date() },
      });

      return steps;
    } catch {
      // Fallback to cached
      const cached = await db
        .select()
        .from(pedometerHistory)
        .where(eq(pedometerHistory.date, dateKey))
        .limit(1);
      return cached[0]?.steps || 0;
    }
  }

  async getTodaySteps(): Promise<number> {
    return this.getStepsForDate(new Date());
  }

  async getStepsForWeek(): Promise<{ date: string; steps: number }[]> {
    const result: { date: string; steps: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = dateString(d);

      const cached = await db
        .select()
        .from(pedometerHistory)
        .where(eq(pedometerHistory.date, dateKey))
        .limit(1);

      if (cached.length > 0) {
        result.push({ date: dateKey, steps: cached[0].steps });
      } else {
        const steps = await this.getStepsForDate(d);
        result.push({ date: dateKey, steps });
      }
    }

    return result;
  }
}

export const pedometerService = PedometerService.getInstance();
