import { db } from '../database';
import { bodyMetrics } from '../../../drizzle/schema';
import { generateUUID } from '../../utils/uuid';
import type { WeightPayload, DispatchResult } from './types';

export async function dispatchWeight(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as WeightPayload;
  if (!data?.date || typeof data.weightKg !== 'number') {
    return { ok: false, summary: 'Missing date or weightKg' };
  }

  await db.insert(bodyMetrics).values({
    id: generateUUID(),
    date: new Date(`${data.date}T00:00:00`),
    weightKg: data.weightKg,
    bodyFatPct: data.bodyFatPct ?? null,
    notes: data.notes ?? null,
    photoUri: null,
    createdAt: new Date(),
  });

  return { ok: true, summary: `Weight: ${data.weightKg}kg on ${data.date}` };
}
