/**
 * Pure, dependency-injected bidirectional sync engine.
 *
 * It knows nothing about SQLite, Supabase or AsyncStorage — those are injected
 * as `LocalStore`, `SyncRemote` and `CursorStore` so the engine is fully unit
 * testable. The concrete adapters live in `syncService.ts`.
 *
 * Strategy (offline-first, last-write-wins):
 *   - Each table carries a monotonic `timestampField` (e.g. `updated_at`).
 *   - A per-table, per-direction cursor records the last synced timestamp.
 *   - push: local rows with timestamp > pushCursor  → remote upsert.
 *   - pull: remote rows with timestamp > pullCursor → local upsert (if newer).
 *   - On error the cursor is NOT advanced, so the change is retried next poll.
 */

export interface SyncTableConfig {
  /** Remote/local table name (identical on both sides). */
  table: string;
  /** Column used as the change cursor (raw snake_case, present on both sides). */
  timestampField: string;
  /** Primary-key column used to resolve upsert conflicts. */
  conflictKey: string;
}

export type SyncRow = Record<string, unknown>;

export interface SyncRemote {
  fetchChangedSince(config: SyncTableConfig, since: number): Promise<SyncRow[]>;
  upsert(config: SyncTableConfig, row: SyncRow): Promise<void>;
}

export interface LocalStore {
  getChangedSince(config: SyncTableConfig, since: number): Promise<SyncRow[]>;
  /** Applies a remote row locally, honouring last-write-wins. Returns true if applied. */
  upsertIfNewer(config: SyncTableConfig, row: SyncRow): Promise<boolean>;
}

export interface CursorStore {
  get(key: string): Promise<number>;
  set(key: string, value: number): Promise<void>;
}

export interface SyncError {
  table: string;
  message: string;
}

export interface SyncResult {
  direction: 'push' | 'pull';
  changes: number;
  pending: number;
  errors: SyncError[];
  success: boolean;
}

export interface SyncStatus {
  pending: number;
  lastSyncAt: number | null;
  errors: SyncError[];
}

export interface SyncEngineDeps {
  remote: SyncRemote;
  local: LocalStore;
  cursors: CursorStore;
  tables: SyncTableConfig[];
  /** When false (e.g. no Supabase credentials) sync is a no-op. */
  isEnabled: () => boolean;
  /** Injectable clock, mainly for tests. */
  now?: () => number;
}

type SyncListener = (result: SyncResult) => void;

function pushKey(table: string): string {
  return `sync:push:${table}`;
}

function pullKey(table: string): string {
  return `sync:pull:${table}`;
}

function toTimestamp(row: SyncRow, field: string): number {
  const value = row[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class SyncEngine {
  private readonly deps: SyncEngineDeps;
  private readonly listeners = new Set<SyncListener>();
  private pending = 0;
  private lastSyncAt: number | null = null;
  private lastErrors: SyncError[] = [];

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
  }

  /** Local → Supabase. Sends every local row changed since the last push. */
  async pushChanges(): Promise<SyncResult> {
    return this.run('push', async (config) => {
      const since = await this.deps.cursors.get(pushKey(config.table));
      const rows = await this.deps.local.getChangedSince(config, since);
      let changes = 0;
      let maxTs = since;
      for (const row of rows) {
        await this.deps.remote.upsert(config, row);
        changes += 1;
        maxTs = Math.max(maxTs, toTimestamp(row, config.timestampField));
      }
      if (maxTs > since) await this.deps.cursors.set(pushKey(config.table), maxTs);
      return changes;
    });
  }

  /** Supabase → local. Applies every remote row changed since the last pull. */
  async pullChanges(): Promise<SyncResult> {
    return this.run('pull', async (config) => {
      const since = await this.deps.cursors.get(pullKey(config.table));
      const rows = await this.deps.remote.fetchChangedSince(config, since);
      let changes = 0;
      let maxTs = since;
      for (const row of rows) {
        const applied = await this.deps.local.upsertIfNewer(config, row);
        if (applied) changes += 1;
        maxTs = Math.max(maxTs, toTimestamp(row, config.timestampField));
      }
      if (maxTs > since) await this.deps.cursors.set(pullKey(config.table), maxTs);
      return changes;
    });
  }

  /** Runs a full push + pull cycle. Intended to be called on a timer / app focus. */
  async poll(): Promise<{ push: SyncResult; pull: SyncResult }> {
    const push = await this.pushChanges();
    const pull = await this.pullChanges();
    return { push, pull };
  }

  getSyncStatus(): SyncStatus {
    return {
      pending: this.pending,
      lastSyncAt: this.lastSyncAt,
      errors: [...this.lastErrors],
    };
  }

  onSyncComplete(callback: SyncListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async run(
    direction: 'push' | 'pull',
    perTable: (config: SyncTableConfig) => Promise<number>,
  ): Promise<SyncResult> {
    if (!this.deps.isEnabled()) {
      const result: SyncResult = { direction, changes: 0, pending: this.pending, errors: [], success: true };
      return result;
    }

    let changes = 0;
    const errors: SyncError[] = [];

    for (const config of this.deps.tables) {
      try {
        changes += await perTable(config);
      } catch (error) {
        errors.push({ table: config.table, message: errorMessage(error) });
      }
    }

    this.pending = errors.length;
    this.lastErrors = errors;
    const success = errors.length === 0;
    if (success) this.lastSyncAt = (this.deps.now ?? Date.now)();

    const result: SyncResult = { direction, changes, pending: this.pending, errors, success };
    this.listeners.forEach((listener) => listener(result));
    return result;
  }
}
