import { eq } from 'drizzle-orm';
import { db } from './database';
import { insightLogs, whoopDaily, type InsightLog } from '../../drizzle/schema';
import { agentService } from './openclawService';
import { syncService } from './syncService';

import {
  Moon, HeartPulse, Zap, Dumbbell, Salad, Dna, Coffee, Wallet, Shuffle,
  type LucideIcon,
} from 'lucide-react-native';

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
 *   - caffeine_logs      (last 7 days)
 *   - finance_orders     (last 30 days)
 *
 * Row shape written by Jarvis (mirrors `insightLogs` below):
 *   { id, generated_at, category, title, body, severity, dismissed: false,
 *     source_agent: 'jarvis', created_at }
 *
 * ---------------------------------------------------------------------------
 * Rules reference (48 rules, Hermes-side implementation)
 * ---------------------------------------------------------------------------
 *
 * SLEEP (category='sleep')
 *   S1 sleep_consistency_low        warning   Consistencia < 50%
 *   S2 sleep_efficiency_too_high    warning   Eficiencia > 96% → privación crónica
 *   S3 sleep_efficiency_too_low     warning   Eficiencia < 85% → entorno
 *   S4 sleep_debt_accumulating      warning   Deuda > 2h en 7 días
 *   S5 deep_sleep_low               info      Sueño profundo < 15%
 *   S6 rem_sleep_low                info      REM < 20%
 *   S7 late_bedtime_trend           warning   Desplazamiento > 1h en 7 días
 *   S8 respiratory_rate_spike       critical  +2 rpm vs baseline → infección
 *   S9 sleep_stress_high            warning   Estrés > 15% del tiempo
 *   S10 wake_time_consistent        info      Variación < 30 min → felicitar
 *   S11 sleep_duration_short        warning   < 6h reales
 *   S12 nap_recovery_benefit        info      Siesta detectada → beneficio
 *
 * RECOVERY (category='recovery')
 *   R1 hrv_drop_significant         critical  HRV -20% vs media 7d
 *   R2 hrv_cv_instability           warning   CV HRV +30% → inestabilidad
 *   R3 rhr_elevated                 warning   RHR +5 bpm vs baseline
 *   R4 recovery_red                 critical  Recovery < 33%
 *   R5 recovery_yellow_trend        warning   3+ días amarillo → deload
 *   R6 green_constant_paradox       warning   7+ días verde → estímulo bajo
 *   R7 spo2_drop                    warning   SpO2 < 95%
 *   R8 skin_temp_elevated           warning   Temp +1°C vs baseline
 *   R9 hrv_improving_trend          info      HRV sube 3+ días
 *   R10 optimal_recovery_window     info      Recovery 66-85% + HRV estable
 *
 * STRAIN (category='strain')
 *   T1 strain_spike                 warning   Strain > 15
 *   T2 strain_weekly_ramp           warning   Aumento > 30% semanal
 *   T3 strain_cardio_only           info      90%+ cardiovascular, sin muscular
 *   T4 zone_distribution_8020       info      Ratio Z1-2 vs Z4-5
 *   T5 strain_low_recovery_green    warning   Strain bajo + verde → undertraining
 *   T6 strain_high_recovery_red     critical  Strain alto + rojo → riesgo
 *   T7 strain_consistency_good      info      Semanal ±15% → periodización
 *   T8 workout_strain_efficiency    info      Strain por minuto
 *
 * NUTRITION (category='nutrition')
 *   N1 late_dinner_hrv_correlation  warning   Cena < 3h dormir + HRV bajó
 *   N2 protein_breakfast_missing    info      Sin proteína en desayuno
 *   N3 sodium_high_hydration        info      Sodio > 3000mg → +0.5L
 *   N4 calorie_deficit_too_aggressive warning Déficit > 1000 kcal/día
 *   N5 protein_total_low            warning   < 1.6g/kg
 *   N6 meal_timing_irregular        info      Horarios irregulares
 *   N7 hydration_insufficient       warning   < 2.5L/día o < 150% sudor
 *
 * GYM (category='gym')
 *   G1 volume_spike                 warning   Semanal +30%
 *   G2 progressive_overload_good    info      +2.5kg → felicitar
 *   G3 rest_time_short              info      Descanso < 2min
 *   G4 exercise_variety_low         info      Mismos 4+ semanas
 *   G5 sets_to_failure_excessive    warning   3+ series al fallo
 *   G6 gym_consistency_good         info      4+ sesiones/semana
 *
 * HEALTHSPAN (category='healthspan')
 *   H1 steps_below_target           info      < 8000 pasos/día
 *   H2 zone2_volume_insufficient    warning   < 150 min/semana Z2
 *   H3 vo2max_estimated_trend       info      Tendencia VO2max
 *   H4 strength_activity_low        warning   < 2 sesiones/semana fuerza
 *   H5 aging_pace_warning           warning   Ritmo envejecimiento acelerado
 *
 * CAFFEINE (category='caffeine')
 *   C1 late_caffeine_sleep_impact   warning   4+ caffeine_logs entries after
 *     16:00 in the trailing 7 days, correlated with a drop in Whoop
 *     deep-sleep minutes on those nights → recommends cutting caffeine
 *     after 14:00.
 *
 * FINANCE (category='finance')
 *   Reserved for future rules driven by finance_orders data (subscriptions,
 *   spending anomalies, budget alerts). Hermes will add rules here when the
 *   data source is ready. Until then, no insights should carry this category.
 *
 * MIXED (sentinel)
 *   Used when a single insight crosses 2+ categories and Hermes cannot
 *   classify it under one primary category. The app renders it under the
 *   Shuffle icon. Hermes should prefer a primary category over MIXED
 *   whenever a dominant domain is clear.
 *
 * The app-side manual-refresh contract: `requestManualRefresh()` below POSTs
 * to `${HERMES_API_URL}/v1/insights/refresh` (same host/auth as the existing
 * Hermes/Jarvis chat endpoint in `openclawService.ts`) to ask Jarvis to run
 * its rules immediately instead of waiting for the next cron tick. This is a
 * proposed contract for the (out-of-repo) Jarvis server, not a guarantee it
 * exists yet.
 */

export type InsightCategory =
  | 'sleep'
  | 'recovery'
  | 'strain'
  | 'gym'
  | 'nutrition'
  | 'healthspan'
  | 'caffeine'
  | 'finance'
  | 'mixed';
export type InsightSeverity = 'info' | 'warning' | 'critical';

// ── Category → icon mapping (single source of truth) ────────────────────────

export const CATEGORY_ICON: Record<InsightCategory, LucideIcon> = {
  sleep: Moon,
  recovery: HeartPulse,
  strain: Zap,
  gym: Dumbbell,
  nutrition: Salad,
  healthspan: Dna,
  caffeine: Coffee,
  finance: Wallet,
  mixed: Shuffle,
};

export const CATEGORY_FILTERS: { category: InsightCategory; label: string; icon: LucideIcon }[] = [
  { category: 'sleep', label: 'Sueño', icon: Moon },
  { category: 'recovery', label: 'Recuperación', icon: HeartPulse },
  { category: 'strain', label: 'Strain', icon: Zap },
  { category: 'gym', label: 'Gimnasio', icon: Dumbbell },
  { category: 'nutrition', label: 'Nutrición', icon: Salad },
  { category: 'healthspan', label: 'Salud', icon: Dna },
  { category: 'caffeine', label: 'Cafeína', icon: Coffee },
  { category: 'finance', label: 'Finanzas', icon: Wallet },
  { category: 'mixed', label: 'Mixto', icon: Shuffle },
];

// ── Daily digest types ──────────────────────────────────────────────────────

export interface WhoopDailySummary {
  recovery: number | null;
  sleep: number | null;
  strain: number | null;
}

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

  /** Returns today's Whoop daily summary for the DailyDigest card. */
  async getDailyDigest(): Promise<WhoopDailySummary | null> {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const rows = await db
      .select({
        recovery: whoopDaily.recoveryScore,
        sleep: whoopDaily.sleepDurationMilli,
        strain: whoopDaily.strain,
      })
      .from(whoopDaily)
      .where(eq(whoopDaily.date, dateStr))
      .limit(1);
    const row = rows[0];
    return row ? { recovery: row.recovery, sleep: row.sleep, strain: row.strain } : null;
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
