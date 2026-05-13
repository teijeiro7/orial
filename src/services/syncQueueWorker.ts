import { db } from './database';
import { syncQueue, habits, habitEntries, userSettings } from '../../drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notionService } from './notionService';
import { notificationService } from './notificationService';
import { generateUUID } from '../utils/uuid';
import type { Habit, HabitEntry } from '../../drizzle/schema';

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export class SyncQueueWorker {
  private isProcessing: boolean = false;
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();

  addStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private updateStatus(status: SyncStatus) {
    this.statusListeners.forEach(listener => listener(status));
  }

  async addToQueue(operation: 'create' | 'update' | 'delete', entity: 'habit' | 'entry' | 'reminder', entityId: string, payload: any): Promise<void> {
    await db.insert(syncQueue).values({
      id: generateUUID(),
      operation,
      entity,
      entityId,
      payload: JSON.stringify(payload),
      createdAt: new Date(),
      retryCount: 0,
    });

    // Try to process immediately if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    const credentials = await notionService.loadCredentials();
    if (!credentials) return;

    this.isProcessing = true;
    this.updateStatus(SyncStatus.SYNCING);

    try {
      const items = await db
        .select()
        .from(syncQueue)
        .orderBy(asc(syncQueue.createdAt));

      for (const item of items) {
        await this.processItem(item);
      }

      this.updateStatus(SyncStatus.SUCCESS);
    } catch (error) {
      console.error('Sync error:', error);
      this.updateStatus(SyncStatus.FAILED);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processItem(item: any): Promise<void> {
    try {
      const payload = JSON.parse(item.payload);
      
      switch (item.entity) {
        case 'habit':
          await this.syncHabit(item.operation, item.entityId, payload);
          break;
        case 'entry':
          await this.syncEntry(item.operation, item.entityId, payload);
          break;
      }

      // Remove from queue on success
      await db.delete(syncQueue).where(eq(syncQueue.id, item.id));
    } catch (error) {
      console.error(`Error processing sync item ${item.id}:`, error);
      
      // Increment retry count
      await db
        .update(syncQueue)
        .set({ 
          retryCount: item.retryCount + 1,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(syncQueue.id, item.id));

      // If max retries reached, mark as failed and notify
      if (item.retryCount >= 3) {
        await notificationService.scheduleStreakMilestone(
          item.entityId,
          'Sync Failed',
          '⚠️',
          0
        );
      }
    }
  }

  private async syncHabit(operation: string, habitId: string, payload: any): Promise<void> {
    const settings = await db.select().from(userSettings).limit(1);
    const habitsDbId = settings[0]?.notionHabitsDbId;
    
    if (!habitsDbId) throw new Error('Habits database ID not configured');

    switch (operation) {
      case 'create':
        const response = await notionService.createHabitPage(habitsDbId, {
          name: payload.name,
          emoji: payload.emoji,
          category: payload.category,
          frequency: payload.frequency,
          targetDays: payload.targetDays,
          targetCount: payload.targetCount,
          active: !payload.isArchived,
          created: payload.createdAt,
          orialId: habitId,
        });
        
        // Update local habit with Notion page ID
        await db
          .update(habits)
          .set({ notionPageId: response.id })
          .where(eq(habits.id, habitId));
        break;

      case 'update':
        if (payload.notionPageId) {
          await notionService.updateHabitPage(payload.notionPageId, {
            name: payload.name,
            emoji: payload.emoji,
            category: payload.category,
            frequency: payload.frequency,
            active: !payload.isArchived,
          });
        }
        break;

      case 'delete':
        if (payload.notionPageId) {
          // Notion doesn't support hard delete via API, we archive instead
          await notionService.updateHabitPage(payload.notionPageId, {
            active: false,
          });
        }
        break;
    }
  }

  private async syncEntry(operation: string, entryId: string, payload: any): Promise<void> {
    const settings = await db.select().from(userSettings).limit(1);
    const logsDbId = settings[0]?.notionLogsDbId;
    
    if (!logsDbId) throw new Error('Logs database ID not configured');

    switch (operation) {
      case 'create':
        await notionService.createLogEntry(logsDbId, {
          date: payload.date,
          habitId: payload.habitNotionId,
          completed: payload.completed,
          note: payload.note,
          orialEntryId: entryId,
        });
        break;
    }
  }

  // Import from Notion (bidirectional sync)
  async importFromNotion(): Promise<void> {
    const credentials = await notionService.loadCredentials();
    if (!credentials) return;

    this.updateStatus(SyncStatus.SYNCING);

    try {
      const settings = await db.select().from(userSettings).limit(1);
      const habitsDbId = settings[0]?.notionHabitsDbId;

      if (!habitsDbId) {
        this.updateStatus(SyncStatus.FAILED);
        return;
      }

      const notionHabits = await notionService.queryHabitsDatabase(habitsDbId);

      for (const notionHabit of notionHabits) {
        const properties = notionHabit.properties;
        const orialId = properties['Orial ID']?.rich_text?.[0]?.text?.content;

        if (!orialId) continue;

        // Check if habit exists locally
        const existingHabit = await db
          .select()
          .from(habits)
          .where(eq(habits.id, orialId))
          .limit(1);

        if (existingHabit.length === 0) {
          // Create local habit from Notion
          const newHabit: Habit = {
            id: orialId,
            name: properties.Name?.title?.[0]?.text?.content || 'Unnamed Habit',
            emoji: properties.Emoji?.rich_text?.[0]?.text?.content || '✅',
            category: properties.Category?.select?.name?.toLowerCase() || 'other',
            frequency: properties.Frequency?.select?.name?.toLowerCase() || 'daily',
            targetDays: JSON.stringify(
              properties['Target Days']?.multi_select?.map((d: any) => d.name) || []
            ),
            targetCount: properties['Target Count']?.number || 1,
            createdAt: new Date(properties.Created?.date?.start || Date.now()),
            description: null,
            notionPageId: notionHabit.id,
            color: null,
            isArchived: !properties.Active?.checkbox,
            isAiSuggested: false,
          };

          await db.insert(habits).values(newHabit);
        }
      }

      this.updateStatus(SyncStatus.SUCCESS);
    } catch (error) {
      console.error('Import error:', error);
      this.updateStatus(SyncStatus.FAILED);
    }
  }

  async getFailedItems(): Promise<any[]> {
    return db
      .select()
      .from(syncQueue)
      .where(and(
        eq(syncQueue.retryCount, 3)
      ));
  }
}

export const syncQueueWorker = new SyncQueueWorker();
