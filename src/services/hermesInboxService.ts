import { db } from './database';
import { hermesInboxLog, type HermesInboxEntry, type NewHermesInboxEntry } from '../../drizzle/schema';
import { agentService } from './openclawService';
import { getDispatcher, listSupportedTypes } from './hermesDispatchers';
import { generateUUID } from '../utils/uuid';
import { eq, and, sql, desc } from 'drizzle-orm';
import { widgetService } from './widgetService';
import type { InboxItem, HermesType } from './hermesDispatchers';

export interface PullResult {
  fetched: number;
  consumed: number;
  failed: number;
  errors: Array<{ externalId: string; type: HermesType; error: string }>;
  durationMs: number;
}

export interface InboxStats {
  total: number;
  pending: number;
  consumed: number;
  failed: number;
  lastPullAt: Date | null;
}

class HermesInboxService {
  private static instance: HermesInboxService;
  private isPolling = false;

  static getInstance(): HermesInboxService {
    if (!HermesInboxService.instance) {
      HermesInboxService.instance = new HermesInboxService();
    }
    return HermesInboxService.instance;
  }

  /**
   * Pull all pending items from the Hermes server, log them, dispatch to
   * the appropriate handler, mark consumed/error in the local audit, then
   * ack (DELETE) on the server. Safe to call concurrently — internal lock
   * prevents overlapping polls.
   */
  async pullAndProcess(options: { silent?: boolean } = {}): Promise<PullResult> {
    if (this.isPolling) {
      return { fetched: 0, consumed: 0, failed: 0, errors: [], durationMs: 0 };
    }

    const configured = await agentService.isHermesServerConfigured();
    if (!configured) {
      return { fetched: 0, consumed: 0, failed: 0, errors: [], durationMs: 0 };
    }

    this.isPolling = true;
    const start = Date.now();
    const errors: PullResult['errors'] = [];
    let consumed = 0;
    let failed = 0;

    try {
      const items = await agentService.fetchPendingInbox();
      if (items.length === 0) {
        return { fetched: 0, consumed: 0, failed: 0, errors: [], durationMs: Date.now() - start };
      }

      for (const item of items) {
        try {
          await this.processOne(item);
          consumed++;
        } catch (e) {
          failed++;
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ externalId: item.id, type: item.type, error: msg });
          console.warn('[HermesInbox] dispatch failed', item.id, item.type, msg);
        }
      }

      // Republish widget snapshot only if something actually changed
      if (consumed > 0) {
        try {
          await widgetService.updateWidgetData();
        } catch (e) {
          console.warn('[HermesInbox] widget refresh failed', e);
        }
      }

      return {
        fetched: items.length,
        consumed,
        failed,
        errors,
        durationMs: Date.now() - start,
      };
    } catch (e) {
      if (!options.silent) {
        console.warn('[HermesInbox] pull failed', e);
      }
      return { fetched: 0, consumed: 0, failed: 0, errors: [], durationMs: Date.now() - start };
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Process a single item: idempotency check → dispatcher → ack.
   * Idempotency: if an entry with the same externalId already exists in
   * `hermes_inbox_log` with status `consumed`, we skip the dispatch and
   * still ack on the server (in case it was redelivered after a crash).
   */
  private async processOne(item: InboxItem): Promise<void> {
    const existing = await db
      .select()
      .from(hermesInboxLog)
      .where(eq(hermesInboxLog.externalId, item.id))
      .limit(1);

    if (existing[0]?.status === 'consumed') {
      // Already processed in a previous run — just ack on the server.
      await agentService.ackInboxItem(item.id);
      return;
    }

    const logId = existing[0]?.id ?? generateUUID();
    if (!existing[0]) {
      const row: NewHermesInboxEntry = {
        id: logId,
        externalId: item.id,
        type: item.type,
        status: 'pending',
        payloadJson: JSON.stringify(item.payload ?? {}),
        error: null,
        receivedAt: new Date(),
        consumedAt: null,
      };
      await db.insert(hermesInboxLog).values(row);
    } else {
      await db
        .update(hermesInboxLog)
        .set({
          type: item.type,
          payloadJson: JSON.stringify(item.payload ?? {}),
          status: 'pending',
          error: null,
        })
        .where(eq(hermesInboxLog.id, logId));
    }

    const dispatcher = getDispatcher(item.type);
    if (!dispatcher) {
      await this.markError(logId, `Unsupported type: ${item.type}`);
      // Still ack so it doesn't keep coming back
      await agentService.ackInboxItem(item.id);
      throw new Error(`Unsupported Hermes inbox type: ${item.type}`);
    }

    try {
      const result = await dispatcher(logId, item.payload);
      if (!result.ok) {
        await this.markError(logId, result.summary);
        await agentService.ackInboxItem(item.id);
        throw new Error(result.summary);
      }
      await this.markConsumed(logId);
      await agentService.ackInboxItem(item.id);
    } catch (e) {
      // markError already called above if dispatcher returned !ok; otherwise
      // this is an unexpected exception thrown by the dispatcher itself.
      const msg = e instanceof Error ? e.message : String(e);
      const alreadyMarked = await this.wasMarkedError(logId);
      if (!alreadyMarked) {
        await this.markError(logId, msg);
      }
      // Always ack on the server — bad payloads shouldn't loop forever.
      await agentService.ackInboxItem(item.id);
      throw e;
    }
  }

  private async markConsumed(logId: string): Promise<void> {
    await db
      .update(hermesInboxLog)
      .set({ status: 'consumed', consumedAt: new Date(), error: null })
      .where(eq(hermesInboxLog.id, logId));
  }

  private async markError(logId: string, error: string): Promise<void> {
    await db
      .update(hermesInboxLog)
      .set({ status: 'error', error })
      .where(eq(hermesInboxLog.id, logId));
  }

  private async wasMarkedError(logId: string): Promise<boolean> {
    const row = await db
      .select({ status: hermesInboxLog.status })
      .from(hermesInboxLog)
      .where(eq(hermesInboxLog.id, logId))
      .limit(1);
    return row[0]?.status === 'error';
  }

  async getRecentEntries(limit = 50): Promise<HermesInboxEntry[]> {
    return db
      .select()
      .from(hermesInboxLog)
      .orderBy(desc(hermesInboxLog.receivedAt))
      .limit(limit);
  }

  async getStats(): Promise<InboxStats> {
    const rows = await db
      .select({
        status: hermesInboxLog.status,
        count: sql<number>`count(*)`,
      })
      .from(hermesInboxLog)
      .groupBy(hermesInboxLog.status);

    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    const lastPull = await db
      .select({ consumedAt: hermesInboxLog.consumedAt })
      .from(hermesInboxLog)
      .orderBy(desc(hermesInboxLog.consumedAt))
      .limit(1);

    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      pending: byStatus.pending ?? 0,
      consumed: byStatus.consumed ?? 0,
      failed: byStatus.error ?? 0,
      lastPullAt: lastPull[0]?.consumedAt ?? null,
    };
  }

  async clearErrorEntries(): Promise<number> {
    const result = await db
      .delete(hermesInboxLog)
      .where(eq(hermesInboxLog.status, 'error'));
    return (result as any).changes ?? 0;
  }

  supportedTypes(): HermesType[] {
    return listSupportedTypes();
  }
}

export const hermesInboxService = HermesInboxService.getInstance();

// Re-export the union so callers can import the type from one place
export type { HermesType } from './hermesDispatchers';
