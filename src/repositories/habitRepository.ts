import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../database';
import { habits, habitEntries, type Habit, type NewHabit, type HabitEntry, type NewHabitEntry } from '../../../drizzle/schema';
import { startOfDay, endOfDay, formatISO } from 'date-fns';

export class HabitRepository {
  async createHabit(data: NewHabit): Promise<Habit> {
    await db.insert(habits).values(data);
    return data as Habit;
  }

  async getHabitById(id: string): Promise<Habit | undefined> {
    const result = await db.select().from(habits).where(eq(habits.id, id)).limit(1);
    return result[0];
  }

  async getActiveHabits(): Promise<Habit[]> {
    return db.select().from(habits).where(eq(habits.isArchived, false));
  }

  async getAllHabits(): Promise<Habit[]> {
    return db.select().from(habits);
  }

  async updateHabit(id: string, data: Partial<NewHabit>): Promise<void> {
    await db.update(habits).set(data).where(eq(habits.id, id));
  }

  async archiveHabit(id: string): Promise<void> {
    await db.update(habits).set({ isArchived: true }).where(eq(habits.id, id));
  }

  async deleteHabit(id: string): Promise<void> {
    await db.delete(habits).where(eq(habits.id, id));
  }

  async toggleHabitEntry(habitId: string, date: Date): Promise<void> {
    const start = startOfDay(date);
    const end = endOfDay(date);
    
    const existing = await db
      .select()
      .from(habitEntries)
      .where(
        and(
          eq(habitEntries.habitId, habitId),
          gte(habitEntries.date, start),
          lte(habitEntries.date, end)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(habitEntries)
        .set({ completed: !existing[0].completed })
        .where(eq(habitEntries.id, existing[0].id));
    } else {
      const newEntry: NewHabitEntry = {
        id: crypto.randomUUID(),
        habitId,
        date: start,
        completed: true,
        createdAt: new Date(),
      };
      await db.insert(habitEntries).values(newEntry);
    }
  }

  async getEntriesForHabit(habitId: string, startDate?: Date, endDate?: Date): Promise<HabitEntry[]> {
    let query = db.select().from(habitEntries).where(eq(habitEntries.habitId, habitId));
    
    if (startDate && endDate) {
      query = db
        .select()
        .from(habitEntries)
        .where(
          and(
            eq(habitEntries.habitId, habitId),
            gte(habitEntries.date, startDate),
            lte(habitEntries.date, endDate)
          )
        );
    }
    
    return query;
  }

  async getTodayEntries(): Promise<HabitEntry[]> {
    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    
    return db
      .select()
      .from(habitEntries)
      .where(
        and(
          gte(habitEntries.date, start),
          lte(habitEntries.date, end)
        )
      );
  }
}

export const habitRepository = new HabitRepository();
