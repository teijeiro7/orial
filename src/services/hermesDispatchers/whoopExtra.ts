import { db } from '../database';
import { whoopExtras } from '../../../drizzle/schema';
import { generateUUID } from '../../utils/uuid';
import type { WhoopExtraPayload, DispatchResult } from './types';

export async function dispatchWhoopExtra(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as WhoopExtraPayload;
  if (!data?.date || !data?.source || typeof data?.data !== 'object' || data.data === null) {
    return { ok: false, summary: 'Missing date, source or data object' };
  }

  const capturedAt = data.capturedAt ? new Date(data.capturedAt) : new Date();

  await db.insert(whoopExtras).values({
    id: generateUUID(),
    date: data.date,
    source: data.source,
    dataJson: JSON.stringify(data.data),
    capturedAt,
    createdAt: new Date(),
  });

  return {
    ok: true,
    summary: `WHOOP ${data.source} captured for ${data.date}`,
  };
}
