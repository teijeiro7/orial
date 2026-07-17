import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './database';
import { bodyMetrics, whoopDaily } from '../../drizzle/schema';
import { eq, gte, lte, desc } from 'drizzle-orm';
import { todayDateString } from '../utils/date';

const NOTIFICATION_HISTORY_STORAGE_KEY = 'forge_notification_last_sent';
const NOTIFICATION_HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ForgeNotificationSettings {
  lowRecoveryEnabled: boolean;
  lowRecoveryThreshold: number;
  weightReminderEnabled: boolean;
  weightReminderDays: number;
  highStrainEnabled: boolean;
  highStrainThreshold: number;
  stepGoalEnabled: boolean;
  stepGoal: number;
}

const DEFAULT_SETTINGS: ForgeNotificationSettings = {
  lowRecoveryEnabled: true,
  lowRecoveryThreshold: 50,
  weightReminderEnabled: true,
  weightReminderDays: 7,
  highStrainEnabled: true,
  highStrainThreshold: 15,
  stepGoalEnabled: false,
  stepGoal: 10000,
};

export class ForgeNotificationService {
  private static instance: ForgeNotificationService;
  private settings: ForgeNotificationSettings = DEFAULT_SETTINGS;

  static getInstance(): ForgeNotificationService {
    if (!ForgeNotificationService.instance) {
      ForgeNotificationService.instance = new ForgeNotificationService();
    }
    return ForgeNotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: false,
          allowCriticalAlerts: false,
        },
      });
      return status === 'granted';
    }
    return true;
  }

  async checkAndSendNotifications(): Promise<void> {
    try {
      await this.checkLowRecovery();
      await this.checkWeightReminder();
      await this.checkHighStrain();
    } catch (e) {
      console.error('[ForgeNotification] check failed:', e);
    }
  }

  private async checkLowRecovery(): Promise<void> {
    if (!this.settings.lowRecoveryEnabled) return;

    const today = todayDateString();
    const result = await db
      .select()
      .from(whoopDaily)
      .where(eq(whoopDaily.date, today))
      .limit(1);

    const metrics = result[0];
    if (!metrics || metrics.recoveryScore === null) return;

    if (metrics.recoveryScore < this.settings.lowRecoveryThreshold) {
      await this.sendNotification({
        title: 'Low Recovery Score',
        body: `Your recovery is ${metrics.recoveryScore}%. Consider taking it easy today and prioritizing rest.`,
        data: { type: 'low_recovery', score: metrics.recoveryScore },
      });
    }
  }

  private async checkWeightReminder(): Promise<void> {
    if (!this.settings.weightReminderEnabled) return;

    const result = await db
      .select()
      .from(bodyMetrics)
      .orderBy(desc(bodyMetrics.date))
      .limit(1);

    const lastEntry = result[0];
    if (!lastEntry) {
      await this.sendNotification({
        title: 'Log Your Weight',
        body: "You haven't logged your weight yet. Start tracking to see your progress!",
        data: { type: 'weight_reminder' },
      });
      return;
    }

    const daysSinceLastEntry = Math.floor(
      (Date.now() - lastEntry.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastEntry >= this.settings.weightReminderDays) {
      await this.sendNotification({
        title: 'Time to Weigh In',
        body: `It's been ${daysSinceLastEntry} days since your last weight entry. Log it now to track your progress!`,
        data: { type: 'weight_reminder', days: daysSinceLastEntry },
      });
    }
  }

  private async checkHighStrain(): Promise<void> {
    if (!this.settings.highStrainEnabled) return;

    const today = todayDateString();
    const result = await db
      .select()
      .from(whoopDaily)
      .where(eq(whoopDaily.date, today))
      .limit(1);

    const metrics = result[0];
    if (!metrics || metrics.strain === null) return;

    if (metrics.strain >= this.settings.highStrainThreshold) {
      await this.sendNotification({
        title: 'Great Workout!',
        body: `Your strain today is ${metrics.strain.toFixed(1)}. That's impressive! Make sure to recover well.`,
        data: { type: 'high_strain', strain: metrics.strain },
      });
    }
  }

  private async sendNotification(config: {
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<void> {
    // Check if we already sent this notification today
    const notificationKey = `forge_${config.data?.type || 'general'}`;
    const lastSent = await this.getLastNotificationTime(notificationKey);
    const now = Date.now();

    // Don't send same notification within 24 hours
    if (lastSent && now - lastSent < 24 * 60 * 60 * 1000) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: config.title,
        body: config.body,
        data: config.data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    await this.setLastNotificationTime(notificationKey, now);
  }

  private async getLastNotificationTime(key: string): Promise<number | null> {
    const history = await this.loadNotificationHistory();
    return history[key] ?? null;
  }

  private async setLastNotificationTime(key: string, timestamp: number): Promise<void> {
    const history = await this.loadNotificationHistory();
    history[key] = timestamp;
    await this.saveNotificationHistory(history);
  }

  /** Loads persisted last-sent timestamps, pruning entries past the cleanup window. */
  private async loadNotificationHistory(): Promise<Record<string, number>> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_HISTORY_STORAGE_KEY);
      if (!stored) return {};
      const history: Record<string, number> = JSON.parse(stored);
      const now = Date.now();
      return Object.fromEntries(
        Object.entries(history).filter(
          ([, timestamp]) => now - timestamp < NOTIFICATION_HISTORY_MAX_AGE_MS
        )
      );
    } catch (error) {
      console.error('[ForgeNotification] Failed to load notification history:', error);
      return {};
    }
  }

  private async saveNotificationHistory(history: Record<string, number>): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATION_HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('[ForgeNotification] Failed to save notification history:', error);
    }
  }

  updateSettings(newSettings: Partial<ForgeNotificationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): ForgeNotificationSettings {
    return this.settings;
  }
}

export const forgeNotificationService = ForgeNotificationService.getInstance();
