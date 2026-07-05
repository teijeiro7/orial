import type { NutritionLog, SodiumIntake } from '../../../drizzle/schema';

export interface NutritionPayload {
  date: string; // YYYY-MM-DD
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  fiberG?: number;
  meals?: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
  }>;
}

export interface WeightPayload {
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number | null;
  notes?: string | null;
}

export interface HydrationPayload {
  date: string; // YYYY-MM-DD
  liters: number;
  beverageType?: 'water' | 'soda_zero' | 'tea' | 'coffee' | 'other';
}

export interface HabitCheckinPayload {
  habitId?: string; // if known by name
  habitName: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  note?: string;
}

export interface ExpensePayload {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  accountId?: string;
  notes?: string;
}

export interface WorkoutPayload {
  routineName: string;
  date: string;
  durationMin?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  strainScore?: number;
  kilojoule?: number;
  zones?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  exercises: Array<{
    name: string;
    sets: Array<{ reps: number; weightKg: number }>;
  }>;
}

export type WhoopExtraSource =
  | 'sleep_detail'
  | 'stress'
  | 'health_monitor'
  | 'target_strain'
  | 'journal'
  | 'workout_detail';

export interface WhoopExtraPayload {
  date: string; // YYYY-MM-DD
  source: WhoopExtraSource;
  capturedAt?: string; // ISO; defaults to now
  data: Record<string, unknown>; // source-specific, flexible
}

export type HermesPayload =
  | { type: 'nutrition'; data: NutritionPayload }
  | { type: 'weight'; data: WeightPayload }
  | { type: 'hydration'; data: HydrationPayload }
  | { type: 'habit_checkin'; data: HabitCheckinPayload }
  | { type: 'expense'; data: ExpensePayload }
  | { type: 'workout'; data: WorkoutPayload }
  | { type: 'whoop_extra'; data: WhoopExtraPayload };

export type HermesType = HermesPayload['type'];

export interface InboxItem {
  id: string; // server-side external id
  type: HermesType;
  payload: unknown; // the `data` field; dispatcher validates per-type
  createdAt: string;
}

export interface DispatchResult {
  ok: boolean;
  summary: string;
  affectedEntityId?: string;
}

export interface DispatcherContext {
  sodiumIntakeInsert: (entry: Omit<SodiumIntake, 'id' | 'createdAt'>) => Promise<void>;
  nutritionLogInsert: (log: Omit<NutritionLog, 'id' | 'createdAt'>) => Promise<void>;
  updateManualMetrics: (date: string, data: Record<string, number | null>) => Promise<void>;
  recalcHydration: (date: string) => Promise<void>;
}
