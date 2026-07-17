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

let settings: ForgeNotificationSettings = DEFAULT_SETTINGS;

async function requestPermissions(): Promise<boolean> {
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

async function checkAndSendNotifications(): Promise<void> {
  try {
    await checkLowRecovery();
    await checkWeightReminder();
    await checkHighStrain();
  } catch (e) {
    console.error('[ForgeNotification] check failed:', e);
  }
}

async function checkLowRecovery(): Promise<void> {
  if (!settings.lowRecoveryEnabled) return;

  const today = todayDateString();
  const result = await db
    .select()
    .from(whoopDaily)
    .where(eq(whoopDaily.date, today))
    .limit(1);

  const metrics = result[0];
  if (!metrics || metrics.recoveryScore === null) return;

  if (metrics.recoveryScore < settings.lowRecoveryThreshold) {
    await sendNotification({
      title: 'Low Recovery Score',
      body: `Your recovery is ${metrics.recoveryScore}%. Consider taking it easy today and prioritizing rest.`,
      data: { type: 'low_recovery', score: metrics.recoveryScore },
    });
  }
}

async function checkWeightReminder(): Promise<void> {
  if (!settings.weightReminderEnabled) return;

  const result = await db
    .select()
    .from(bodyMetrics)
    .orderBy(desc(bodyMetrics.date))
    .limit(1);

  const lastEntry = result[0];
  if (!lastEntry) {
    await sendNotification({
      title: 'Log Your Weight',
      body: "You haven't logged your weight yet. Start tracking to see your progress!",
      data: { type: 'weight_reminder' },
    });
    return;
  }

  const daysSinceLastEntry = Math.floor(
    (Date.now() - lastEntry.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastEntry >= settings.weightReminderDays) {
    await sendNotification({
      title: 'Time to Weigh In',
      body: `It's been ${daysSinceLastEntry} days since your last weight entry. Log it now to track your progress!`,
      data: { type: 'weight_reminder', days: daysSinceLastEntry },
    });
  }
}

async function checkHighStrain(): Promise<void> {
  if (!settings.highStrainEnabled) return;

  const today = todayDateString();
  const result = await db
    .select()
    .from(whoopDaily)
    .where(eq(whoopDaily.date, today))
    .limit(1);

  const metrics = result[0];
  if (!metrics || metrics.strain === null) return;

  if (metrics.strain >= settings.highStrainThreshold) {
    await sendNotification({
      title: 'Great Workout!',
      body: `Your strain today is ${metrics.strain.toFixed(1)}. That's impressive! Make sure to recover well.`,
      data: { type: 'high_strain', strain: metrics.strain },
    });
  }
}

async function sendNotification(config: {
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  // Check if we already sent this notification today
  const notificationKey = `forge_${config.data?.type || 'general'}`;
  const lastSent = await getLastNotificationTime(notificationKey);
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

  await setLastNotificationTime(notificationKey, now);
}

async function getLastNotificationTime(key: string): Promise<number | null> {
  const history = await loadNotificationHistory();
  return history[key] ?? null;
}

async function setLastNotificationTime(key: string, timestamp: number): Promise<void> {
  const history = await loadNotificationHistory();
  history[key] = timestamp;
  await saveNotificationHistory(history);
}

/** Loads persisted last-sent timestamps, pruning entries past the cleanup window. */
async function loadNotificationHistory(): Promise<Record<string, number>> {
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

async function saveNotificationHistory(history: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('[ForgeNotification] Failed to save notification history:', error);
  }
}

function updateSettings(newSettings: Partial<ForgeNotificationSettings>): void {
  settings = { ...settings, ...newSettings };
}

function getSettings(): ForgeNotificationSettings {
  return settings;
}

export const forgeNotificationService = {
  requestPermissions,
  checkAndSendNotifications,
  updateSettings,
  getSettings,
};
