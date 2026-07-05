import { db } from '../database';
import { habits, habitEntries } from '../../../drizzle/schema';
import { and, eq } from 'drizzle-orm';
import { generateUUID } from '../../utils/uuid';
import type { HabitCheckinPayload, DispatchResult } from './types';

export async function dispatchHabitCheckin(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as HabitCheckinPayload;
  if (!data?.date || !data.habitName) {
    return { ok: false, summary: 'Missing date or habitName' };
  }

  let habitId = data.habitId ?? null;
  if (!habitId) {
    const rows = await db
      .select()
      .from(habits)
      .where(and(eq(habits.name, data.habitName), eq(habits.isArchived, false)))
      .limit(1);
    habitId = rows[0]?.id ?? null;
  }

  if (!habitId) {
    return {
      ok: false,
      summary: `Habit not found by name: "${data.habitName}"`,
    };
  }

  const entryDate = new Date(`${data.date}T00:00:00`);
  const existing = await db
    .select()
    .from(habitEntries)
    .where(and(eq(habitEntries.habitId, habitId), eq(habitEntries.date, entryDate)))
    .limit(1);

  const completed = data.completed ?? true;

  if (existing[0]) {
    await db
      .update(habitEntries)
      .set({ completed, note: data.note ?? null })
      .where(eq(habitEntries.id, existing[0].id));
  } else {
    await db.insert(habitEntries).values({
      id: generateUUID(),
      habitId,
      date: entryDate,
      completed,
      createdAt: new Date(),
      note: data.note ?? null,
      notionEntryId: null,
      isSynced: false,
    });
  }

  return {
    ok: true,
    summary: `Habit ${data.habitName} → ${completed ? 'done' : 'skipped'}`,
    affectedEntityId: habitId,
  };
}
