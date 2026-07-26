jest.mock('./database', () => ({
  expoDb: {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));

jest.mock('./supabaseService', () => ({
  supabaseService: {
    upsert: jest.fn(),
    isConfigured: jest.fn(),
    getClient: jest.fn(),
  },
}));

jest.mock('./authService', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(),
  },
}));

import { expoDb } from './database';
import { supabaseService } from './supabaseService';
import { authService } from './authService';
import { supabaseRemote, syncService, DEFAULT_SYNC_TABLES } from './syncService';

const mockExpoDb = expoDb as jest.Mocked<typeof expoDb>;
const mockSupabase = supabaseService as jest.Mocked<typeof supabaseService>;
const mockAuth = authService as jest.Mocked<typeof authService>;

const TABLE_CONFIG = { table: 'hydration', timestampField: 'updated_at', conflictKey: 'date' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('supabaseRemote.upsert', () => {
  it('stamps the row with the signed-in user id before upserting', async () => {
    mockAuth.getCurrentUser.mockReturnValue({ id: 'user-1' } as never);

    await supabaseRemote.upsert(TABLE_CONFIG, { date: '2026-01-01', ml: 500 });

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      'hydration',
      { date: '2026-01-01', ml: 500, user_id: 'user-1' },
      'date',
    );
  });

  it('throws instead of pushing a row with no user_id when nobody is signed in', async () => {
    mockAuth.getCurrentUser.mockReturnValue(null);

    await expect(supabaseRemote.upsert(TABLE_CONFIG, { date: '2026-01-01' })).rejects.toThrow(
      'Cannot push changes: no authenticated user',
    );
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });
});

describe('syncService.isEnabled guard', () => {
  it('does not push when configured but not authenticated', async () => {
    mockSupabase.isConfigured.mockReturnValue(true);
    mockAuth.isAuthenticated.mockReturnValue(false);
    mockExpoDb.getAllAsync.mockResolvedValue([{ date: '2026-01-01', updated_at: 10 }]);

    const result = await syncService.pushChanges();

    expect(result).toEqual({ direction: 'push', changes: 0, pending: 0, errors: [], success: true });
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });

  it('pushes local changes once configured and authenticated', async () => {
    mockSupabase.isConfigured.mockReturnValue(true);
    mockAuth.isAuthenticated.mockReturnValue(true);
    mockAuth.getCurrentUser.mockReturnValue({ id: 'user-1' } as never);
    // Every configured table is walked; return no changes except for one table
    // so the assertion only has to reason about a single upsert call.
    mockExpoDb.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT * FROM hydration ')) return [{ date: '2026-01-01', updated_at: 10 }];
      return [];
    });

    const result = await syncService.pushChanges();

    expect(result.success).toBe(true);
    expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      'hydration',
      { date: '2026-01-01', updated_at: 10, user_id: 'user-1' },
      'date',
    );
  });

  it('does not sync when Supabase is not configured, even if authenticated', async () => {
    mockSupabase.isConfigured.mockReturnValue(false);
    mockAuth.isAuthenticated.mockReturnValue(true);

    const result = await syncService.pushChanges();

    expect(result.changes).toBe(0);
    expect(mockSupabase.upsert).not.toHaveBeenCalled();
  });
});

it('registers a config entry per DEFAULT_SYNC_TABLES table', () => {
  expect(DEFAULT_SYNC_TABLES.length).toBeGreaterThan(0);
  expect(DEFAULT_SYNC_TABLES.every((c) => c.table && c.timestampField && c.conflictKey)).toBe(true);
});
