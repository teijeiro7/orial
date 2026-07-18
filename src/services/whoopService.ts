import { db } from './database';
import { whoopDaily, bodyMetrics, pedometerHistory, type WhoopDaily, type NewWhoopDaily, type NewBodyMetric, type NewPedometerEntry } from '../../drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import * as SecureStore from 'expo-secure-store';
import { todayDateString, dateString } from '../utils/date';
import { supabaseService } from './supabaseService';

const STORE_KEY_ACCESS = 'whoop_access_token';
const STORE_KEY_REFRESH = 'whoop_refresh_token';
const STORE_KEY_EXPIRES = 'whoop_expires_at';

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';
const WHOOP_TOKEN_EDGE_FUNCTION = 'whoop-token';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const CLIENT_ID = getRequiredEnv('EXPO_PUBLIC_WHOOP_CLIENT_ID');
const REDIRECT_URI = 'orial://whoop/callback';

const SCOPES = [
  'offline',
  'read:recovery',
  'read:cycles',
  'read:workout',
  'read:sleep',
  'read:profile',
  'read:body_measurement',
].join(' ');

interface WhoopAuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

interface CycleResponse {
  id: number;
  start: string;
  end: string;
  score_state: string;
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

interface RecoveryResponse {
  cycle_id: number;
  sleep_id: string;
  score_state: string;
  score?: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
}

interface SleepResponse {
  id: string;
  cycle_id: number;
  start: string;
  end: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_light_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
    };
    sleep_performance_percentage: number;
    respiratory_rate: number;
  };
}

interface WorkoutResponse {
  id: string;
  start: string;
  end: string;
  sport_name: string;
  score_state: string;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    distance_meter: number;
    altitude_gain_meter: number;
  };
}

interface BodyMeasurementResponse {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

let authState: WhoopAuthState | null = null;

async function getAuthState(): Promise<WhoopAuthState | null> {
  if (authState) return authState;

  const accessToken = await SecureStore.getItemAsync(STORE_KEY_ACCESS);
  const refreshToken = await SecureStore.getItemAsync(STORE_KEY_REFRESH);
  const expiresAt = await SecureStore.getItemAsync(STORE_KEY_EXPIRES);

  if (accessToken && refreshToken && expiresAt) {
    authState = {
      accessToken,
      refreshToken,
      expiresAt: new Date(expiresAt),
      scope: 'offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement',
    };
    return authState;
  }

  return null;
}

async function saveAuthState(state: WhoopAuthState): Promise<void> {
  authState = state;
  await SecureStore.setItemAsync(STORE_KEY_ACCESS, state.accessToken);
  await SecureStore.setItemAsync(STORE_KEY_REFRESH, state.refreshToken);
  await SecureStore.setItemAsync(STORE_KEY_EXPIRES, state.expiresAt.toISOString());
}

async function clearAuthState(): Promise<void> {
  authState = null;
  await SecureStore.deleteItemAsync(STORE_KEY_ACCESS);
  await SecureStore.deleteItemAsync(STORE_KEY_REFRESH);
  await SecureStore.deleteItemAsync(STORE_KEY_EXPIRES);
}

function isConnected(): Promise<boolean> {
  return getAuthState().then((s) => s !== null);
}

function getAuthUrl(): string {
  const state = Math.random().toString(36).substring(2, 10);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

async function handleCallback(code: string): Promise<void> {
  const { data, error } = await supabaseService.getClient().functions.invoke(WHOOP_TOKEN_EDGE_FUNCTION, {
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    },
  });

  if (error) {
    throw new Error(`Whoop token exchange failed: ${error.message}`);
  }

  await saveAuthState({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    scope: data.scope,
  });
}

async function forceRefreshToken(): Promise<string> {
  const state = await getAuthState();
  if (!state) throw new Error('Not connected to Whoop');

  const { data, error } = await supabaseService.getClient().functions.invoke(WHOOP_TOKEN_EDGE_FUNCTION, {
    body: {
      grant_type: 'refresh_token',
      refresh_token: state.refreshToken,
    },
  });

  if (error) {
    console.error('[Whoop] refresh failed:', error.message);
    await clearAuthState();
    throw new Error(`Failed to refresh Whoop token: ${error.message}`);
  }

  await saveAuthState({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    scope: data.scope,
  });
  return data.access_token;
}

async function ensureValidToken(): Promise<string> {
  const state = await getAuthState();
  if (!state) throw new Error('Not connected to Whoop');

  if (new Date() > state.expiresAt) {
    return forceRefreshToken();
  }

  return state.accessToken;
}

async function fetchWhoop<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await ensureValidToken();
  const url = new URL(`${WHOOP_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const doFetch = (t: string) =>
    fetch(url.toString(), { headers: { Authorization: `Bearer ${t}` } });

  let response = await doFetch(token);

  if (response.status === 401) {
    const newToken = await forceRefreshToken();
    response = await doFetch(newToken);
  }

  if (!response.ok) {
    if (response.status === 401) await clearAuthState();
    throw new Error(`Whoop API ${path}: ${response.status}`);
  }

  return response.json();
}

async function fetchTodayCycle(): Promise<CycleResponse | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data = await fetchWhoop<{ records: CycleResponse[] }>('/cycle', {
    start: today.toISOString(),
    limit: '1',
  });
  return data.records[0] || null;
}

async function fetchTodayRecovery(cycleId: number): Promise<RecoveryResponse | null> {
  try {
    return await fetchWhoop<RecoveryResponse>(`/cycle/${cycleId}/recovery`);
  } catch {
    return null;
  }
}

async function fetchSleepForCycle(cycleId: number): Promise<SleepResponse | null> {
  try {
    return await fetchWhoop<SleepResponse>(`/cycle/${cycleId}/sleep`);
  } catch {
    return null;
  }
}

async function fetchTodayWorkouts(): Promise<WorkoutResponse[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const data = await fetchWhoop<{ records: WorkoutResponse[] }>('/activity/workout', {
    start: today.toISOString(),
    limit: '10',
  });
  return data.records;
}

async function fetchBodyMeasurement(): Promise<BodyMeasurementResponse | null> {
  try {
    return await fetchWhoop<BodyMeasurementResponse>('/user/measurement/body');
  } catch {
    return null;
  }
}

async function syncToday(): Promise<void> {
  const cycle = await fetchTodayCycle();
  if (!cycle) return;

  let recovery: RecoveryResponse | null = null;
  let sleep: SleepResponse | null = null;

  if (cycle.score_state === 'SCORED') {
    recovery = await fetchTodayRecovery(cycle.id);
    sleep = await fetchSleepForCycle(cycle.id);
  }

  // Fetch body measurement and update if available
  const bodyMeasurement = await fetchBodyMeasurement();
  if (bodyMeasurement?.weight_kilogram) {
    const today = todayDateString();
    await db.insert(bodyMetrics).values({
      id: generateUUID(),
      date: new Date(today),
      weightKg: bodyMeasurement.weight_kilogram,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: bodyMetrics.date, // FIX: upsert by date, not by id (id is always a new UUID and never conflicts)
      set: {
        weightKg: bodyMeasurement.weight_kilogram,
        // modified_at is bumped automatically by the DB trigger (see migration 0004)
      },
    });
  }

  const today = todayDateString();
  const dailyData: NewWhoopDaily = {
    date: today,
    strain: cycle.score?.strain ?? null,
    kilojoule: cycle.score?.kilojoule ?? null,
    avgHeartRate: cycle.score?.average_heart_rate ?? null,
    maxHeartRate: cycle.score?.max_heart_rate ?? null,
    recoveryScore: recovery?.score?.recovery_score ?? null,
    restingHeartRate: recovery?.score?.resting_heart_rate ?? null,
    hrvRmssdMilli: recovery?.score?.hrv_rmssd_milli ?? null,
    spo2Percentage: recovery?.score?.spo2_percentage ?? null,
    skinTempCelsius: recovery?.score?.skin_temp_celsius ?? null,
    sleepPerformance: sleep?.score?.sleep_performance_percentage ?? null,
    sleepDurationMilli: sleep?.score?.stage_summary?.total_in_bed_time_milli ?? null,
    respiratoryRate: sleep?.score?.respiratory_rate ?? null,
    nap: sleep?.nap ?? null,
    raw: JSON.stringify({ cycle, recovery, sleep }),
    updatedAt: new Date(),
  };

  await db.insert(whoopDaily).values(dailyData).onConflictDoUpdate({
    target: whoopDaily.date,
    set: dailyData,
  });
}

async function getTodayMetrics(): Promise<WhoopDaily | null> {
  const today = todayDateString();
  const result = await db.select().from(whoopDaily).where(eq(whoopDaily.date, today)).limit(1);
  return result[0] || null;
}

async function getHistory(days: number = 7): Promise<WhoopDaily[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = dateString(start);

  return db
    .select()
    .from(whoopDaily)
    .where(gte(whoopDaily.date, startDate))
    .orderBy(whoopDaily.date);
}

async function disconnect(): Promise<void> {
  try {
    const token = await ensureValidToken();
    await fetch('https://api.prod.whoop.com/developer/v2/user/access', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Revoke may fail if token expired, remove locally anyway
  }
  await clearAuthState();
}

export const whoopService = {
  isConnected,
  getAuthUrl,
  handleCallback,
  fetchTodayCycle,
  fetchTodayRecovery,
  fetchSleepForCycle,
  fetchTodayWorkouts,
  fetchBodyMeasurement,
  syncToday,
  getTodayMetrics,
  getHistory,
  disconnect,
};
