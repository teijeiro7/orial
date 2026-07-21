/**
 * whoopService reads `process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID` at module load time
 * (`getRequiredEnv`) and caches an in-memory `authState` across calls. Both of these
 * are module-scoped, so every test re-requires the module fresh (via
 * `jest.resetModules()`) to avoid one test's auth state leaking into the next, and
 * to avoid a static `import` (which is hoisted above this file's own statements)
 * running before the env var below is set.
 */
import type { WhoopDaily } from '../../drizzle/schema';

const WHOOP_CLIENT_ID = 'test-whoop-client-id';

type SecureStoreMock = {
  setItemAsync: jest.Mock;
  getItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

type DbMock = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

let whoopService: typeof import('./whoopService').whoopService;
let mockedSecureStore: SecureStoreMock;
let mockedDb: DbMock;
let mockInvoke: jest.Mock;

/** Seeds SecureStore so `getAuthState()` resolves to a connected, non-expired session. */
function seedConnectedAuthState({
  accessToken = 'access-token',
  refreshToken = 'refresh-token',
  expiresAt = new Date(Date.now() + 3600_000).toISOString(),
}: { accessToken?: string; refreshToken?: string; expiresAt?: string } = {}) {
  mockedSecureStore.getItemAsync.mockImplementation((key: string) => {
    if (key === 'whoop_access_token') return Promise.resolve(accessToken);
    if (key === 'whoop_refresh_token') return Promise.resolve(refreshToken);
    if (key === 'whoop_expires_at') return Promise.resolve(expiresAt);
    return Promise.resolve(null);
  });
}

/** Mocks `db.select().from().where().limit(n)` resolving to `rows`. */
function mockSelectWithLimit(rows: unknown[]) {
  mockedDb.select.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** Mocks `db.select().from().where().orderBy()` resolving to `rows`. */
function mockSelectWithOrderBy(rows: unknown[]) {
  mockedDb.select.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID = WHOOP_CLIENT_ID;

  jest.doMock('./database', () => ({
    db: { select: jest.fn(), insert: jest.fn(), update: jest.fn() },
    expoDb: { runAsync: jest.fn() },
  }));
  jest.doMock('expo-secure-store', () => ({
    setItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  }));
  mockInvoke = jest.fn();
  jest.doMock('./supabaseService', () => ({
    supabaseService: {
      getClient: jest.fn(() => ({ functions: { invoke: mockInvoke } })),
    },
  }));

  mockedSecureStore = require('expo-secure-store');
  mockedDb = require('./database').db;
  whoopService = require('./whoopService').whoopService;

  (global as any).fetch = jest.fn();
});

afterEach(() => {
  jest.dontMock('./database');
  jest.dontMock('expo-secure-store');
  jest.dontMock('./supabaseService');
});

describe('getAuthUrl', () => {
  it('builds the WHOOP OAuth URL with the configured client id and redirect uri', () => {
    const url = whoopService.getAuthUrl();

    expect(url.startsWith('https://api.prod.whoop.com/oauth/oauth2/auth?')).toBe(true);
    expect(url).toContain(`client_id=${WHOOP_CLIENT_ID}`);
    expect(url).toContain(`redirect_uri=${encodeURIComponent('orial://whoop/callback')}`);
  });
});

describe('isConnected', () => {
  it('returns false when no tokens are stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(whoopService.isConnected()).resolves.toBe(false);
  });

  it('returns true once tokens are stored', async () => {
    seedConnectedAuthState();

    await expect(whoopService.isConnected()).resolves.toBe(true);
  });
});

describe('handleCallback', () => {
  it('exchanges the code for tokens via the whoop-token Edge Function and persists them', async () => {
    mockInvoke.mockResolvedValue({
      data: { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, scope: 'offline' },
      error: null,
    });

    await whoopService.handleCallback('auth-code-123');

    expect(mockInvoke).toHaveBeenCalledWith('whoop-token', {
      body: {
        grant_type: 'authorization_code',
        code: 'auth-code-123',
        redirect_uri: 'orial://whoop/callback',
      },
    });
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('whoop_access_token', 'access-1');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('whoop_refresh_token', 'refresh-1');
  });

  it('throws when the Edge Function returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'invalid_grant' } });

    await expect(whoopService.handleCallback('bad-code')).rejects.toThrow(
      'Whoop token exchange failed: invalid_grant',
    );
    expect(mockedSecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('fetchTodayCycle (and the shared fetchWhoop/token-refresh path)', () => {
  it('throws when there is no stored auth state', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow('Not connected to Whoop');
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
  });

  it('fetches with the stored access token and returns the first record', async () => {
    seedConnectedAuthState({ accessToken: 'valid-token' });
    const cycle = { id: 1, start: '2026-07-17', end: '2026-07-18', score_state: 'SCORED' };
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { records: [cycle] }));

    const result = await whoopService.fetchTodayCycle();

    expect(result).toEqual(cycle);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/cycle');
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toEqual({
      headers: { Authorization: 'Bearer valid-token' },
    });
  });

  it('returns null when there are no records for today', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { records: [] }));

    await expect(whoopService.fetchTodayCycle()).resolves.toBeNull();
  });

  it('refreshes an expired token before making the request', async () => {
    seedConnectedAuthState({
      accessToken: 'expired-token',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    mockInvoke.mockResolvedValue({
      data: { access_token: 'refreshed-token', refresh_token: 'refresh-2', expires_in: 3600, scope: 'offline' },
      error: null,
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { records: [] }));

    await whoopService.fetchTodayCycle();

    expect(mockInvoke).toHaveBeenCalledWith('whoop-token', {
      body: { grant_type: 'refresh_token', refresh_token: 'refresh-token' },
    });
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toEqual({
      headers: { Authorization: 'Bearer refreshed-token' },
    });
  });

  it('retries once with a refreshed token when the API returns 401', async () => {
    seedConnectedAuthState({ accessToken: 'stale-token' });
    mockInvoke.mockResolvedValue({
      data: { access_token: 'fresh-token', refresh_token: 'refresh-2', expires_in: 3600, scope: 'offline' },
      error: null,
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { records: [] }));

    await whoopService.fetchTodayCycle();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((global.fetch as jest.Mock).mock.calls[1][1]).toEqual({
      headers: { Authorization: 'Bearer fresh-token' },
    });
  });

  it('clears the auth state and throws when the retried request still 401s', async () => {
    seedConnectedAuthState({ accessToken: 'stale-token' });
    mockInvoke.mockResolvedValue({
      data: { access_token: 'fresh-token', refresh_token: 'refresh-2', expires_in: 3600, scope: 'offline' },
      error: null,
    });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, {}));

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow('Whoop account revoked or access denied');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_access_token');
  });

  it('throws (without clearing auth) when the API returns a non-401 error status', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, {}));

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow('Whoop API /cycle: 500');
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('does NOT clear auth when the API returns 5xx (transient error)', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(503, {}));

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow('Whoop API /cycle: 503');
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('clears the auth state and throws when the token refresh returns invalid_grant', async () => {
    seedConnectedAuthState({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'invalid_grant' } });

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow(
      'Whoop refresh token expired or revoked',
    );
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_access_token');
  });

  it('does NOT clear auth when the token refresh fails with a transient error', async () => {
    seedConnectedAuthState({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'server error' } });

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow('Whoop sync paused: server error');
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('does NOT clear auth when the token refresh fetch throws (network error)', async () => {
    seedConnectedAuthState({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    mockInvoke.mockRejectedValue(new Error('network unreachable'));

    await expect(whoopService.fetchTodayCycle()).rejects.toThrow();
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('fetchTodayRecovery / fetchSleepForCycle / fetchBodyMeasurement', () => {
  it('fetchTodayRecovery returns null instead of throwing when the request fails', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, {}));

    await expect(whoopService.fetchTodayRecovery(1)).resolves.toBeNull();
  });

  it('fetchSleepForCycle returns null instead of throwing when the request fails', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, {}));

    await expect(whoopService.fetchSleepForCycle(1)).resolves.toBeNull();
  });

  it('fetchBodyMeasurement returns null instead of throwing when the request fails', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(500, {}));

    await expect(whoopService.fetchBodyMeasurement()).resolves.toBeNull();
  });
});

describe('fetchTodayWorkouts', () => {
  it('returns the list of workout records for today', async () => {
    seedConnectedAuthState();
    const workouts = [{ id: 'w1', start: '2026-07-17', end: '2026-07-17', sport_name: 'run', score_state: 'SCORED' }];
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { records: workouts }));

    await expect(whoopService.fetchTodayWorkouts()).resolves.toEqual(workouts);
  });
});

describe('getTodayMetrics', () => {
  it('returns null when there is no row for today', async () => {
    mockSelectWithLimit([]);

    await expect(whoopService.getTodayMetrics()).resolves.toBeNull();
  });

  it('returns the row for today when one exists', async () => {
    const row = { date: '2026-07-17', strain: 10 } as unknown as WhoopDaily;
    mockSelectWithLimit([row]);

    await expect(whoopService.getTodayMetrics()).resolves.toEqual(row);
  });
});

describe('getHistory', () => {
  it('returns the rows within the requested window', async () => {
    const rows = [{ date: '2026-07-10' }, { date: '2026-07-11' }] as unknown as WhoopDaily[];
    mockSelectWithOrderBy(rows);

    await expect(whoopService.getHistory(7)).resolves.toEqual(rows);
  });
});

describe('disconnect', () => {
  it('clears local auth state even when the revoke request throws', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network unreachable'));

    await expect(whoopService.disconnect()).resolves.toBeUndefined();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_access_token');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_refresh_token');
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_expires_at');
  });

  it('clears local auth state even when there was nothing to revoke', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    await expect(whoopService.disconnect()).resolves.toBeUndefined();

    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith('whoop_access_token');
  });
});

describe('syncToday', () => {
  it('does nothing when there is no cycle recorded for today', async () => {
    seedConnectedAuthState();
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { records: [] }));

    await whoopService.syncToday();

    expect(mockedDb.insert).not.toHaveBeenCalled();
  });

  it('writes body-measurement and daily rows once the cycle is scored', async () => {
    seedConnectedAuthState();
    const cycle = {
      id: 42,
      start: '2026-07-17',
      end: '2026-07-18',
      score_state: 'SCORED',
      score: { strain: 10, kilojoule: 500, average_heart_rate: 60, max_heart_rate: 150 },
    };
    const recovery = {
      cycle_id: 42,
      sleep_id: 's1',
      score_state: 'SCORED',
      score: {
        recovery_score: 80,
        resting_heart_rate: 55,
        hrv_rmssd_milli: 40,
        spo2_percentage: 97,
        skin_temp_celsius: 33,
      },
    };
    const sleep = {
      id: 's1',
      cycle_id: 42,
      start: '2026-07-16',
      end: '2026-07-17',
      nap: false,
      score_state: 'SCORED',
      score: {
        stage_summary: {
          total_in_bed_time_milli: 1000,
          total_light_sleep_time_milli: 100,
          total_rem_sleep_time_milli: 100,
          total_slow_wave_sleep_time_milli: 100,
        },
        sleep_performance_percentage: 90,
        respiratory_rate: 14,
      },
    };
    const bodyMeasurement = { height_meter: 1.8, weight_kilogram: 80, max_heart_rate: 190 };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/recovery')) return Promise.resolve(jsonResponse(200, recovery));
      if (url.includes('/sleep')) return Promise.resolve(jsonResponse(200, sleep));
      if (url.includes('/measurement/body')) return Promise.resolve(jsonResponse(200, bodyMeasurement));
      return Promise.resolve(jsonResponse(200, { records: [cycle] }));
    });

    const onConflictDoUpdate = jest.fn();
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    mockedDb.insert.mockReturnValue({ values });

    await whoopService.syncToday();

    expect(mockedDb.insert).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80 }));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ strain: 10, recoveryScore: 80, sleepPerformance: 90 }));
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });

  it('skips the body-measurement write when no weight is returned, but still writes the daily row', async () => {
    seedConnectedAuthState();
    const cycle = {
      id: 7,
      start: '2026-07-17',
      end: '2026-07-18',
      score_state: 'PENDING_SCORE',
    };

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/measurement/body')) return Promise.resolve(jsonResponse(500, {}));
      return Promise.resolve(jsonResponse(200, { records: [cycle] }));
    });

    const onConflictDoUpdate = jest.fn();
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    mockedDb.insert.mockReturnValue({ values });

    await whoopService.syncToday();

    expect(mockedDb.insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ strain: null, recoveryScore: null }));
  });

  it('clears lastSyncError after a successful sync', async () => {
    seedConnectedAuthState();
    const cycle = { id: 1, start: '2026-07-17', end: '2026-07-18', score_state: 'PENDING_SCORE' };
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/measurement/body')) return Promise.resolve(jsonResponse(500, {}));
      return Promise.resolve(jsonResponse(200, { records: [cycle] }));
    });

    const onConflictDoUpdate = jest.fn();
    const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
    mockedDb.insert.mockReturnValue({ values });

    await whoopService.syncToday();

    expect(whoopService.getLastSyncError()).toBeNull();
  });
});
