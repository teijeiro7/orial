import { hydrationService } from '../hydrationService';
import type { HydrationPayload, DispatchResult } from './types';

export async function dispatchHydration(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as HydrationPayload;
  if (!data?.date || typeof data.liters !== 'number') {
    return { ok: false, summary: 'Missing date or liters' };
  }

  const beverage = data.beverageType ?? 'water';
  await hydrationService.addWater(data.date, data.liters, beverage);

  return {
    ok: true,
    summary: `Hydration: +${data.liters}L (${beverage}) on ${data.date}`,
  };
}
