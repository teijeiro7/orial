import { eq } from 'drizzle-orm';
import { db } from './database';
import { insightLogs, type InsightLog } from '../../drizzle/schema';
import { agentService } from './openclawService';
import { syncService } from './syncService';

/**
 * ============================================================================
 * Jarvis Insights Engine — contract (documentation only; the generator is a
 * server-side Jarvis cron, out of scope for this repo)
 * ============================================================================
 *
 * Jarvis periodically (suggested: every 6-8h, plus on-demand when the user
 * taps "Actualizar insights") reads Supabase, evaluates a set of rules, and
 * writes results directly into the `insight_logs` table in Supabase. The app
 * never generates insights itself — it only reads what Jarvis produced (via
 * syncService's regular pull) and lets the user dismiss them locally.
 *
 * Data Jarvis reads per run:
 *   - whoop_daily        (last 7 days)
 *   - gym_sessions       (last 7 days, joined with gym_sets/gym_exercises)
 *   - nutrition_logs     (last 7 days)
 *   - caffeine_logs      (last 7 days — T1 table)
 *   - finance_orders     (last 30 days)
 *
 * Row shape written by Jarvis (mirrors `insightLogs` below):
 *   { id, generated_at, category, title, body, severity, dismissed: false,
 *     source_agent: 'jarvis', created_at }
 *
 * At least 3 rule types must be implemented server-side; documented examples:
 *
 *   - sleep (😴): 3+ consecutive days of whoop_daily.sleepDurationMilli < 6h
 *     AND hrvRmssdMilli dropped >= 15% vs the trailing 7-day average →
 *     severity 'critical', body references the HRV drop and recommends
 *     lowering today's training intensity.
 *
 *   - gym (🏋️): an exercise's current_weight_kg increased over the last 6
 *     weeks of gym_sets for that exercise → severity 'info' (achievement),
 *     body states the kg gained.
 *
 *   - caffeine (☕): 4+ caffeine_logs entries after 16:00 in the trailing 7
 *     days, correlated with a drop in Whoop deep-sleep minutes on those
 *     nights → severity 'warning', body recommends cutting caffeine after
 *     14:00.
 *
 * The app-side manual-refresh contract: `requestManualRefresh()` below POSTs
 * to `${HERMES_API_URL}/v1/insights/refresh` (same host/auth as the existing
 * Hermes/Jarvis chat endpoint in `openclawService.ts`) to ask Jarvis to run
 * its rules immediately instead of waiting for the next cron tick. This is a
 * proposed contract for the (out-of-repo) Jarvis server, not a guarantee it
 * exists yet.
 */

export type InsightCategory = 'sleep' | 'gym' | 'finance' | 'nutrition' | 'caffeine' | 'mixed';
export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface Insight {
  id: string;
  generatedAt: Date;
  category: InsightCategory;
  title: string;
  body: string;
  severity: InsightSeverity;
  dismissed: boolean;
  sourceAgent: string;
  createdAt: Date;
}

/** Lower rank sorts first: critical > warning > info. */
const SEVERITY_RANK: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function toInsight(row: InsightLog): Insight {
  return {
    id: row.id,
    generatedAt: row.generatedAt,
    category: row.category as InsightCategory,
    title: row.title,
    body: row.body,
    severity: (row.severity as InsightSeverity) ?? 'info',
    dismissed: row.dismissed,
    sourceAgent: row.sourceAgent,
    createdAt: row.createdAt,
  };
}

/**
 * Pure sort: severity first (critical → warning → info), then most recent
 * `generatedAt` first within the same severity. Never mutates the input.
 */
export function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return b.generatedAt.getTime() - a.generatedAt.getTime();
  });
}

/**
 * Pure filter: drops dismissed insights, and optionally restricts to a
 * single category.
 */
export function filterInsights(insights: Insight[], category?: InsightCategory): Insight[] {
  return insights.filter((insight) => !insight.dismissed && (!category || insight.category === category));
}

/**
 * Pure, immutable "dismiss" reducer over an in-memory list — used both by
 * the unit tests below and by the insights screen for an optimistic local
 * update while the real `dismissInsight()` write is in flight.
 */
export function applyDismiss(insights: Insight[], id: string): Insight[] {
  return insights.map((insight) => (insight.id === id ? { ...insight, dismissed: true } : insight));
}

export class InsightService {
  private static instance: InsightService;

  static getInstance(): InsightService {
    if (!InsightService.instance) {
      InsightService.instance = new InsightService();
    }
    return InsightService.instance;
  }

  /** Reads all insights from the local DB, then filters + sorts in memory. */
  async getInsights(category?: InsightCategory): Promise<Insight[]> {
    const rows = (await db.select().from(insightLogs)) as InsightLog[];
    const insights = rows.map(toInsight);
    return sortInsights(filterInsights(insights, category));
  }

  /** Marks an insight as dismissed. Local-only; see syncService.ts for why. */
  async dismissInsight(id: string): Promise<void> {
    await db.update(insightLogs).set({ dismissed: true }).where(eq(insightLogs.id, id));
  }

  /**
   * Asks Jarvis to (re)generate insights right now instead of waiting for the
   * next cron tick, then best-effort pulls whatever it has already written to
   * Supabase. See the module-level contract doc for the endpoint shape.
   */
  async requestManualRefresh(): Promise<void> {
    const config = await agentService.getConfig();
    if (!config) {
      throw new Error('Jarvis no está configurado. Añade la URL y API key en Ajustes.');
    }

    const response = await fetch(`${config.apiUrl}/v1/insights/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jarvis insights refresh failed (${response.status}): ${errorText}`);
    }

    await syncService.pullChanges();
  }
}

export const insightService = InsightService.getInstance();
