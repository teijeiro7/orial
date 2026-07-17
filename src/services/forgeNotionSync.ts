import { db } from './database';
import { bodyMetrics, whoopDaily, userSettings } from '../../drizzle/schema';
import { eq, desc, gte } from 'drizzle-orm';
import { dateString } from '../utils/date';

const NOTION_API_BASE = 'https://api.notion.com/v1';

interface NotionWeightEntry {
  id?: string;
  date: string;
  weight: number;
  notes?: string | null;
}

interface NotionDailyMetrics {
  date: string;
  recoveryScore: number | null;
  strain: number | null;
  caloriesBurned: number | null;
  sleepHours: number | null;
  hrv: number | null;
  rhr: number | null;
}

export class ForgeNotionSync {
  private static instance: ForgeNotionSync;

  static getInstance(): ForgeNotionSync {
    if (!ForgeNotionSync.instance) {
      ForgeNotionSync.instance = new ForgeNotionSync();
    }
    return ForgeNotionSync.instance;
  }

  async syncWeightEntry(entry: {
    id: string;
    date: Date;
    weightKg: number | null;
    notes: string | null;
  }): Promise<void> {
    const settings = await this.getNotionSettings();
    if (!settings.notionLogsDbId) {
      console.warn('[ForgeNotion] No logs DB configured');
      return;
    }

    const notionEntry: NotionWeightEntry = {
      date: dateString(entry.date),
      weight: entry.weightKg || 0,
      notes: entry.notes,
    };

    try {
      // Create page in Notion logs database
      await this.createNotionPage(settings.notionLogsDbId, {
        Name: {
          title: [
            {
              text: {
                content: `Weight: ${notionEntry.weight}kg - ${notionEntry.date}`,
              },
            },
          ],
        },
        Date: {
          date: {
            start: notionEntry.date,
          },
        },
        Weight: {
          number: notionEntry.weight,
        },
        Notes: notionEntry.notes
          ? {
              rich_text: [
                {
                  text: {
                    content: notionEntry.notes,
                  },
                },
              ],
            }
          : {},
      });

      console.log('[ForgeNotion] Weight entry synced to Notion');
    } catch (e) {
      console.error('[ForgeNotion] Sync weight failed:', e);
    }
  }

  async syncDailyMetrics(date: string): Promise<void> {
    const settings = await this.getNotionSettings();
    if (!settings.notionLogsDbId) return;

    const result = await db
      .select()
      .from(whoopDaily)
      .where(eq(whoopDaily.date, date))
      .limit(1);

    const metrics = result[0];
    if (!metrics) return;

    const notionMetrics: NotionDailyMetrics = {
      date,
      recoveryScore: metrics.recoveryScore,
      strain: metrics.strain,
      caloriesBurned: metrics.kilojoule ? Math.round(metrics.kilojoule / 4.184) : null,
      sleepHours: metrics.sleepDurationMilli
        ? Math.round(metrics.sleepDurationMilli / 3600000 * 10) / 10
        : null,
      hrv: metrics.hrvRmssdMilli ? Math.round(metrics.hrvRmssdMilli) : null,
      rhr: metrics.restingHeartRate,
    };

    try {
      await this.createNotionPage(settings.notionLogsDbId, {
        Name: {
          title: [
            {
              text: {
                content: `Daily Metrics - ${notionMetrics.date}`,
              },
            },
          ],
        },
        Date: {
          date: {
            start: notionMetrics.date,
          },
        },
        Recovery: notionMetrics.recoveryScore
          ? { number: notionMetrics.recoveryScore }
          : {},
        Strain: notionMetrics.strain ? { number: notionMetrics.strain } : {},
        'Calories Burned': notionMetrics.caloriesBurned
          ? { number: notionMetrics.caloriesBurned }
          : {},
        'Sleep Hours': notionMetrics.sleepHours
          ? { number: notionMetrics.sleepHours }
          : {},
        HRV: notionMetrics.hrv ? { number: notionMetrics.hrv } : {},
        'Resting HR': notionMetrics.rhr ? { number: notionMetrics.rhr } : {},
      });

      console.log('[ForgeNotion] Daily metrics synced to Notion');
    } catch (e) {
      console.error('[ForgeNotion] Sync daily metrics failed:', e);
    }
  }

  private async getNotionSettings(): Promise<{
    notionLogsDbId: string | null;
  }> {
    const result = await db.select().from(userSettings).limit(1);
    return {
      notionLogsDbId: result[0]?.notionLogsDbId || null,
    };
  }

  private async createNotionPage(
    databaseId: string,
    properties: Record<string, any>
  ): Promise<void> {
    const response = await fetch(`${NOTION_API_BASE}/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} ${error}`);
    }
  }
}

export const forgeNotionSync = ForgeNotionSync.getInstance();
