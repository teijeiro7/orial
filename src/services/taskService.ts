import { db } from './database';
import { tasks } from '../../drizzle/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import { todayDateString, dateString } from '../utils/date';
import type { Task, NewTask } from '../../drizzle/schema';

export const taskService = {
  async getTasksForDate(date: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.date, date))
      .orderBy(tasks.scheduledHour, tasks.priority, tasks.createdAt);
  },

  async createTask(input: {
    title: string;
    date?: string;
    scheduledHour?: number;
    priority?: number;
  }): Promise<Task> {
    const now = new Date();
    const task: NewTask = {
      id: generateUUID(),
      title: input.title,
      date: input.date ?? todayDateString(),
      scheduledHour: input.scheduledHour ?? null,
      completed: false,
      priority: input.priority ?? 0,
      pushedFrom: null,
      completedAt: null,
      createdAt: now,
    };
    await db.insert(tasks).values(task);
    return task as Task;
  },

  async toggleTask(id: string): Promise<void> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return;
    const now = new Date();
    await db
      .update(tasks)
      .set({
        completed: !task.completed,
        completedAt: !task.completed ? now : null,
      })
      .where(eq(tasks.id, id));
  },

  async updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'scheduledHour' | 'priority'>>): Promise<void> {
    await db.update(tasks).set(updates).where(eq(tasks.id, id));
  },

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  },

  async pushRemainingToTomorrow(date: string): Promise<number> {
    const dayTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, date)));

    const incomplete = dayTasks.filter((t) => !t.completed);
    if (incomplete.length === 0) return 0;

    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dateString(tomorrow);

    await Promise.all(
      incomplete.map((t) =>
        db.update(tasks).set({ date: tomorrowStr, pushedFrom: t.pushedFrom ?? date }).where(eq(tasks.id, t.id))
      )
    );

    return incomplete.length;
  },

  async getDailyStreak(): Promise<number> {
    // Count consecutive days (ending today) where user completed at least one task
    const today = todayDateString();
    let streak = 0;
    let checking = new Date();

    for (let i = 0; i < 365; i++) {
      const d = dateString(checking);
      const dayTasks = await db.select().from(tasks).where(eq(tasks.date, d));
      const hasCompleted = dayTasks.some((t) => t.completed);

      if (d === today && dayTasks.length === 0) {
        // today not yet started — don't break streak
      } else if (!hasCompleted && dayTasks.length > 0) {
        break;
      } else if (hasCompleted) {
        streak++;
      } else {
        break;
      }

      checking.setDate(checking.getDate() - 1);
    }

    return streak;
  },
};
