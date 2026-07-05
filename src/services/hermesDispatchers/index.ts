import { dispatchNutrition } from './nutrition';
import { dispatchWeight } from './weight';
import { dispatchHydration } from './hydration';
import { dispatchHabitCheckin } from './habitCheckin';
import { dispatchExpense } from './expense';
import { dispatchWorkout } from './workout';
import { dispatchWhoopExtra } from './whoopExtra';
import type { DispatchResult, HermesType, HermesPayload, InboxItem } from './types';

export type Dispatcher = (inboxLogId: string, payload: unknown) => Promise<DispatchResult>;

const registry: Record<HermesType, Dispatcher> = {
  nutrition: dispatchNutrition,
  weight: dispatchWeight,
  hydration: dispatchHydration,
  habit_checkin: dispatchHabitCheckin,
  expense: dispatchExpense,
  workout: dispatchWorkout,
  whoop_extra: dispatchWhoopExtra,
};

export function getDispatcher(type: HermesType): Dispatcher | null {
  return registry[type] ?? null;
}

export function listSupportedTypes(): HermesType[] {
  return Object.keys(registry) as HermesType[];
}

export type { DispatchResult, HermesType, HermesPayload, InboxItem };
