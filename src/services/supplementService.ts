import { db } from './database';
import { supplements, supplementLogs, type Supplement, type NewSupplement, type NewSupplementLog, type SupplementLog } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import * as Notifications from 'expo-notifications';

export class SupplementService {
  private static instance: SupplementService;

  static getInstance(): SupplementService {
    if (!SupplementService.instance) {
      SupplementService.instance = new SupplementService();
    }
    return SupplementService.instance;
  }

  async createSupplement(data: Omit<NewSupplement, 'id' | 'createdAt'>): Promise<Supplement> {
    const newSupplement: NewSupplement = {
      ...data,
      id: generateUUID(),
      createdAt: new Date(),
    };

    await db.insert(supplements).values(newSupplement);
    const result = await db.select().from(supplements).where(eq(supplements.id, newSupplement.id)).limit(1);
    
    if (data.reminderTime) {
      await this.scheduleReminder(result[0]);
    }

    return result[0];
  }

  async updateSupplement(id: string, data: Partial<Pick<Supplement, 'name' | 'dailyDoseMg' | 'reminderTime' | 'type'>>): Promise<void> {
    await db.update(supplements).set(data).where(eq(supplements.id, id));
    if (data.reminderTime !== undefined) {
      await this.cancelReminders(id);
      const result = await db.select().from(supplements).where(eq(supplements.id, id)).limit(1);
      if (result[0]?.reminderTime) await this.scheduleReminder(result[0]);
    }
  }

  async getSupplements(): Promise<Supplement[]> {
    return db.select().from(supplements).where(eq(supplements.isActive, true));
  }

  async logSupplement(supplementId: string, date: string, doseMg: number, takenAt?: Date, skipped: boolean = false): Promise<void> {
    const existing = await db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.date, date)
        )
      )
      .limit(1);

    const logData: NewSupplementLog = {
      id: generateUUID(),
      supplementId,
      date,
      doseMg,
      takenAt: takenAt || new Date(),
      skipped,
      createdAt: new Date(),
    };

    if (existing[0]) {
      await db.update(supplementLogs)
        .set(logData)
        .where(eq(supplementLogs.id, existing[0].id));
    } else {
      await db.insert(supplementLogs).values(logData);
    }
  }

  async getTodayLogs(date?: string): Promise<(SupplementLog & { supplement: Supplement })[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const activeSupplements = await this.getSupplements();
    
    const logs = await db
      .select()
      .from(supplementLogs)
      .where(eq(supplementLogs.date, targetDate));

    return activeSupplements.map(supplement => {
      const log = logs.find(l => l.supplementId === supplement.id);
      return {
        ...(log || {
          id: '',
          supplementId: supplement.id,
          date: targetDate,
          doseMg: 0,
          takenAt: null,
          skipped: false,
          notes: null,
          createdAt: new Date(),
          modifiedAt: 0,
        }),
        supplement,
      };
    });
  }

  async getHistory(supplementId: string, days: number = 14): Promise<{ date: string; doseMg: number; takenAt: Date | null; skipped: boolean }[]> {
    const result = await db
      .select()
      .from(supplementLogs)
      .where(eq(supplementLogs.supplementId, supplementId))
      .orderBy(desc(supplementLogs.date))
      .limit(days);

    return result.map(r => ({
      date: r.date,
      doseMg: r.doseMg,
      takenAt: r.takenAt,
      skipped: r.skipped,
    }));
  }

  async getStreak(supplementId: string): Promise<number> {
    const logs = await db
      .select()
      .from(supplementLogs)
      .where(
        and(
          eq(supplementLogs.supplementId, supplementId),
          eq(supplementLogs.skipped, false)
        )
      )
      .orderBy(desc(supplementLogs.date));

    if (logs.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const log of logs) {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
      } else if (diffDays > streak) {
        break;
      }
    }

    return streak;
  }

  private async scheduleReminder(supplement: Supplement): Promise<void> {
    if (!supplement.reminderTime) return;

    const parts = supplement.reminderTime.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💊 Suplemento',
        body: `Toma ${supplement.name} (${supplement.dailyDoseMg}mg)`,
        data: { supplementId: supplement.id },
      },
      trigger: {
        type: 'daily',
        hour: hours,
        minute: minutes,
      } as Notifications.DailyTriggerInput,
    });
  }

  async cancelReminders(supplementId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.supplementId === supplementId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }
}

export const supplementService = SupplementService.getInstance();
