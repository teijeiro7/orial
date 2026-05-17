import { db } from './database';
import { whoopTokens, whoopDaily, bodyMetrics, pedometerHistory, type WhoopDaily, type NewWhoopToken, type NewWhoopDaily, type NewBodyMetric, type NewPedometerEntry } from '../../drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { generateUUID } from '../utils/uuid';
import * as SecureStore from 'expo-secure-store';

const STORE_KEY_ACCESS = 'whoop_access_token';
const STORE_KEY_REFRESH = 'whoop_refresh_token';
const STORE_KEY_EXPIRES = 'whoop_expires_at';

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v2';

const CLIENT_ID = 'WHOOP_CLIENT_ID_REMOVED';
const CLIENT_SECRET = 'WHOOP_CLIENT_SECRET_REMOVED';
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

export class WhoopService {
  private static instance: WhoopService;
  private authState: WhoopAuthState | null = null;

  static getInstance(): WhoopService {
    if (!WhoopService.instance) {
      WhoopService.instance = new WhoopService();
    }
    return WhoopService.instance;
  }

  private async getAuthState(): Promise<WhoopAuthState | null> {
    if (this.authState) return this.authState;

    const accessToken = await SecureStore.getItemAsync(STORE_KEY_ACCESS);
    const refreshToken = await SecureStore.getItemAsync(STORE_KEY_REFRESH);
    const expiresAt = await SecureStore.getItemAsync(STORE_KEY_EXPIRES);

    if (accessToken && refreshToken && expiresAt) {
      this.authState = {
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAt),
        scope: 'offline read:recovery read:cycles read:workout read:sleep read:profile read:body_measurement',
      };
      return this.authState;
    }

    return null;
  }

  private async saveAuthState(state: WhoopAuthState): Promise<void> {
    this.authState = state;
    await SecureStore.setItemAsync(STORE_KEY_ACCESS, state.accessToken);
    await SecureStore.setItemAsync(STORE_KEY_REFRESH, state.refreshToken);
    await SecureStore.setItemAsync(STORE_KEY_EXPIRES, state.expiresAt.toISOString());
  }

  private async clearAuthState(): Promise<void> {
    this.authState = null;
    await SecureStore.deleteItemAsync(STORE_KEY_ACCESS);
    await SecureStore.deleteItemAsync(STORE_KEY_REFRESH);
    await SecureStore.deleteItemAsync(STORE_KEY_EXPIRES);
  }

  isConnected(): Promise<boolean> {
    return this.getAuthState().then((s) => s !== null);
  }

  getAuthUrl(): string {
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

  async handleCallback(code: string): Promise<void> {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whoop token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    await this.saveAuthState({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      scope: data.scope,
    });

    // Save to DB for backup
    await db.insert(whoopTokens).values({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      scope: data.scope,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: whoopTokens.id,
      set: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
        scope: data.scope,
      },
    });
  }

  private async ensureValidToken(): Promise<string> {
    const state = await this.getAuthState();
    if (!state) throw new Error('Not connected to Whoop');

    if (new Date() > state.expiresAt) {
      const response = await fetch(WHOOP_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: state.refreshToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          scope: 'offline',
        }),
      });

      if (!response.ok) {
        await this.clearAuthState();
        throw new Error('Failed to refresh Whoop token');
      }

      const data = await response.json();
      await this.saveAuthState({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
        scope: data.scope,
      });
      return data.access_token;
    }

    return state.accessToken;
  }

  private async fetchWhoop<T>(path: string, params?: Record<string, string>): Promise<T> {
    const token = await this.ensureValidToken();
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Whoop API ${path}: ${response.status}`);
    }

    return response.json();
  }

  async fetchTodayCycle(): Promise<CycleResponse | null> {
    const today = new Date().toISOString();
    const data = await this.fetchWhoop<{ records: CycleResponse[] }>('/v2/cycle', {
      start: today,
      limit: '1',
    });
    return data.records[0] || null;
  }

  async fetchTodayRecovery(cycleId: number): Promise<RecoveryResponse | null> {
    try {
      return await this.fetchWhoop<RecoveryResponse>(`/v2/cycle/${cycleId}/recovery`);
    } catch {
      return null;
    }
  }

  async fetchSleepForCycle(cycleId: number): Promise<SleepResponse | null> {
    try {
      return await this.fetchWhoop<SleepResponse>(`/v2/cycle/${cycleId}/sleep`);
    } catch {
      return null;
    }
  }

  async fetchTodayWorkouts(): Promise<WorkoutResponse[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const data = await this.fetchWhoop<{ records: WorkoutResponse[] }>('/v2/activity/workout', {
      start: today.toISOString(),
      limit: '10',
    });
    return data.records;
  }

  async fetchBodyMeasurement(): Promise<BodyMeasurementResponse | null> {
    try {
      return await this.fetchWhoop<BodyMeasurementResponse>('/v2/user/measurement/body');
    } catch {
      return null;
    }
  }

  async syncToday(): Promise<void> {
    const cycle = await this.fetchTodayCycle();
    if (!cycle) return;

    let recovery: RecoveryResponse | null = null;
    let sleep: SleepResponse | null = null;

    if (cycle.score_state === 'SCORED') {
      recovery = await this.fetchTodayRecovery(cycle.id);
      sleep = await this.fetchSleepForCycle(cycle.id);
    }

    // Fetch body measurement and update if available
    const bodyMeasurement = await this.fetchBodyMeasurement();
    if (bodyMeasurement?.weight_kilogram) {
      const today = new Date().toISOString().split('T')[0];
      await db.insert(bodyMetrics).values({
        id: generateUUID(),
        date: new Date(today),
        weightKg: bodyMeasurement.weight_kilogram,
        createdAt: new Date(),
      }).onConflictDoUpdate({
        target: bodyMetrics.id,
        set: {
          weightKg: bodyMeasurement.weight_kilogram,
        },
      });
    }

    const today = new Date().toISOString().split('T')[0];
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

  async getTodayMetrics(): Promise<WhoopDaily | null> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.select().from(whoopDaily).where(eq(whoopDaily.date, today)).limit(1);
    return result[0] || null;
  }

  async getHistory(days: number = 7): Promise<WhoopDaily[]> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().split('T')[0];

    return db
      .select()
      .from(whoopDaily)
      .where(gte(whoopDaily.date, startDate))
      .orderBy(whoopDaily.date);
  }

  async disconnect(): Promise<void> {
    try {
      const token = await this.ensureValidToken();
      await fetch('https://api.prod.whoop.com/developer/v2/user/access', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Revoke may fail if token expired, remove locally anyway
    }
    await this.clearAuthState();
    await db.delete(whoopTokens);
  }
}

export const whoopService = WhoopService.getInstance();
