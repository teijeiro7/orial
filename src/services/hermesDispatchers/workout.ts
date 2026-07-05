import { gymService } from '../gymService';
import type { WorkoutPayload, DispatchResult } from './types';

export async function dispatchWorkout(
  inboxLogId: string,
  payload: unknown,
): Promise<DispatchResult> {
  const data = payload as WorkoutPayload;
  if (!data?.date || !data.routineName || !Array.isArray(data.exercises)) {
    return { ok: false, summary: 'Missing date, routineName or exercises' };
  }

  const session = await gymService.createSessionFromHermes(data);

  return {
    ok: true,
    summary: `Workout: ${data.routineName} (${data.exercises.length} exercises) on ${data.date}`,
    affectedEntityId: session.id,
  };
}
