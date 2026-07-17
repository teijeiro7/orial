import {
  SyncEngine,
  shouldApplyIncoming,
  type SyncTableConfig,
  type SyncRemote,
  type LocalStore,
  type CursorStore,
  type SyncRow,
} from './syncEngine';

const TABLES: SyncTableConfig[] = [
  { table: 'hydration', timestampField: 'updated_at', conflictKey: 'date' },
];

function makeCursors(initial: Record<string, number> = {}): CursorStore {
  const store = new Map<string, number>(Object.entries(initial));
  return {
    get: async (key) => store.get(key) ?? 0,
    set: async (key, value) => {
      store.set(key, value);
    },
    // test helper exposed via closure
  } as CursorStore & { _store?: Map<string, number> };
}

describe('SyncEngine', () => {
  let remote: jest.Mocked<SyncRemote>;
  let local: jest.Mocked<LocalStore>;
  let cursors: CursorStore;

  beforeEach(() => {
    remote = {
      fetchChangedSince: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    local = {
      getChangedSince: jest.fn().mockResolvedValue([]),
      upsertIfNewer: jest.fn().mockResolvedValue(true),
    };
    cursors = makeCursors();
  });

  function engine(overrides: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) {
    return new SyncEngine({
      remote,
      local,
      cursors,
      tables: TABLES,
      isEnabled: () => true,
      ...overrides,
    });
  }

  describe('pushChanges', () => {
    it('pushes local rows changed since the cursor and advances it to the max timestamp', async () => {
      const rows: SyncRow[] = [
        { date: '2026-01-01', updated_at: 100 },
        { date: '2026-01-02', updated_at: 250 },
      ];
      local.getChangedSince.mockResolvedValue(rows);

      const result = await engine().pushChanges();

      expect(local.getChangedSince).toHaveBeenCalledWith(TABLES[0], 0);
      expect(remote.upsert).toHaveBeenCalledTimes(2);
      expect(remote.upsert).toHaveBeenCalledWith(TABLES[0], rows[0]);
      expect(result.changes).toBe(2);
      expect(result.success).toBe(true);
      // Cursor advanced so the next push starts after the newest row.
      expect(await cursors.get('sync:push:hydration')).toBe(250);
    });

    it('records an error and does NOT advance the cursor when a remote upsert fails', async () => {
      local.getChangedSince.mockResolvedValue([{ date: '2026-01-01', updated_at: 100 }]);
      remote.upsert.mockRejectedValue(new Error('network down'));

      const result = await engine().pushChanges();

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([{ table: 'hydration', message: 'network down' }]);
      expect(await cursors.get('sync:push:hydration')).toBe(0);
      expect(result.pending).toBeGreaterThan(0);
    });

    it('does nothing and reports success when sync is disabled (no credentials)', async () => {
      local.getChangedSince.mockResolvedValue([{ date: 'x', updated_at: 5 }]);

      const result = await engine({ isEnabled: () => false }).pushChanges();

      expect(remote.upsert).not.toHaveBeenCalled();
      expect(local.getChangedSince).not.toHaveBeenCalled();
      expect(result.changes).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('pullChanges', () => {
    it('fetches remote rows changed since the cursor and applies them locally (last-write-wins)', async () => {
      const rows: SyncRow[] = [
        { date: '2026-01-01', updated_at: 300 },
        { date: '2026-01-02', updated_at: 420 },
      ];
      remote.fetchChangedSince.mockResolvedValue(rows);

      const result = await engine().pullChanges();

      expect(remote.fetchChangedSince).toHaveBeenCalledWith(TABLES[0], 0);
      expect(local.upsertIfNewer).toHaveBeenCalledTimes(2);
      expect(result.changes).toBe(2);
      expect(await cursors.get('sync:pull:hydration')).toBe(420);
    });

    it('counts only rows actually applied by last-write-wins', async () => {
      remote.fetchChangedSince.mockResolvedValue([
        { date: '2026-01-01', updated_at: 300 },
        { date: '2026-01-02', updated_at: 420 },
      ]);
      // First row is stale locally (not applied), second is newer (applied).
      local.upsertIfNewer.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const result = await engine().pullChanges();

      expect(result.changes).toBe(1);
    });

    it('records an error and keeps the cursor when the remote fetch fails', async () => {
      remote.fetchChangedSince.mockRejectedValue(new Error('offline'));

      const result = await engine().pullChanges();

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('offline');
      expect(await cursors.get('sync:pull:hydration')).toBe(0);
    });
  });

  describe('shouldApplyIncoming (last-write-wins tiebreak)', () => {
    it('applies the incoming row when it is strictly newer than the local copy', () => {
      // Arrange
      const existingTs = 100;
      const incomingTs = 250;
      // Act / Assert
      expect(shouldApplyIncoming(existingTs, incomingTs)).toBe(true);
    });

    it('does NOT apply the incoming row when it is older than the local copy', () => {
      expect(shouldApplyIncoming(300, 250)).toBe(false);
    });

    it('does NOT apply the incoming row on a timestamp tie (keeps the local row)', () => {
      expect(shouldApplyIncoming(250, 250)).toBe(false);
    });

    it('inserts when there is no existing local row (null/undefined timestamp)', () => {
      expect(shouldApplyIncoming(null, 1)).toBe(true);
      expect(shouldApplyIncoming(undefined, 0)).toBe(true);
    });

    it('treats a non-finite local timestamp as no existing row and applies', () => {
      expect(shouldApplyIncoming(Number.NaN, 5)).toBe(true);
    });
  });

  describe('status and listeners', () => {
    it('poll runs push then pull and notifies onSyncComplete listeners', async () => {
      const listener = jest.fn();
      const e = engine();
      e.onSyncComplete(listener);

      await e.poll();

      expect(listener).toHaveBeenCalled();
      const status = e.getSyncStatus();
      expect(status.lastSyncAt).not.toBeNull();
      expect(status.errors).toEqual([]);
    });

    it('getSyncStatus surfaces pending count and errors after a failed push', async () => {
      local.getChangedSince.mockResolvedValue([{ date: 'x', updated_at: 10 }]);
      remote.upsert.mockRejectedValue(new Error('boom'));
      const e = engine();

      await e.pushChanges();
      const status = e.getSyncStatus();

      expect(status.pending).toBeGreaterThan(0);
      expect(status.errors[0].message).toBe('boom');
    });
  });
});
