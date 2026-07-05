import { db } from '../database';
import { generateUUID } from '../../utils/uuid';
import { nutritionService } from '../nutritionService';
import type { NutritionPayload, DispatchResult } from './types';

export async function dispatchNutrition(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as NutritionPayload;
  if (
    !data?.date ||
    typeof data.totalCalories !== 'number' ||
    typeof data.proteinG !== 'number' ||
    typeof data.carbsG !== 'number' ||
    typeof data.fatG !== 'number' ||
    typeof data.sodiumMg !== 'number'
  ) {
    return { ok: false, summary: 'Missing required nutrition fields' };
  }

  await nutritionService.importFromOpenclaw(data);

  return {
    ok: true,
    summary: `Nutrition: ${data.totalCalories}kcal, P${data.proteinG} C${data.carbsG} F${data.fatG} Na${data.sodiumMg}mg`,
  };
}
