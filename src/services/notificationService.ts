import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { OrialColors } from '../utils/colors';
import { formatHM } from '../utils/time';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  /**
   * Used by syncQueueWorker.ts to notify on repeated sync failures. Signature
   * predates the habits-feature removal — kept because syncQueueWorker (not
   * deleted, see removal report) still calls it.
   */
  async scheduleStreakMilestone(habitId: string, habitName: string, emoji: string, streakCount: number): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Streak Milestone!',
          body: `${emoji} ${habitName}: ${streakCount} day streak! Keep it up!`,
          data: {
            type: 'streak_milestone',
            habitId,
            streakCount,
          },
          sound: 'default',
        },
        trigger: null, // Immediate notification
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling milestone notification:', error);
      return null;
    }
  }

  async cancelAllReminders(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all reminders:', error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async scheduleSubscriptionAlert(alert: {
    subscriptionId: string;
    name: string;
    amount: number;
    currency: string;
    daysUntilBilling: number;
  }): Promise<string | null> {
    try {
      const when = alert.daysUntilBilling <= 0 ? 'hoy' : `en ${alert.daysUntilBilling} días`;
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💳 Próximo cobro',
          body: `${alert.name} cobra ${when} (${alert.amount.toFixed(2)}${alert.currency === 'EUR' ? '€' : ` ${alert.currency}`})`,
          data: {
            type: 'subscription_alert',
            subscriptionId: alert.subscriptionId,
          },
          sound: 'default',
        },
        trigger: null, // Immediate notification
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling subscription alert:', error);
      return null;
    }
  }

  async scheduleWishlistAffordable(itemName: string, percentage: number): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 ¡Ya puedes permitírtelo!',
          body: `¡Ya puedes permitirte ${itemName}! Solo es el ${percentage.toFixed(2)}% de tu patrimonio ahora.`,
          data: {
            type: 'wishlist_affordable',
            itemName,
          },
          sound: 'default',
        },
        trigger: null, // Immediate notification
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling wishlist affordable notification:', error);
      return null;
    }
  }

  /**
   * Immediate alert fired right after logging a dose that will still be
   * above the interference threshold at bedtime, e.g.
   * "⚠️ Has tomado café a las 16:00. Se eliminará a las 21:00. Esto puede
   * interferir con tu hora de dormir (23:00)."
   */
  async scheduleCaffeineSleepInterferenceAlert(loggedAt: Date, clearAt: Date, bedtime: Date): Promise<string | null> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Cafeína y sueño',
          body: `Has tomado café a las ${formatHM(loggedAt)}. Se eliminará a las ${formatHM(clearAt)}. Esto puede interferir con tu hora de dormir (${formatHM(bedtime)}).`,
          data: { type: 'caffeine_sleep_interference' },
          sound: 'default',
        },
        trigger: null, // Immediate notification
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling caffeine sleep interference alert:', error);
      return null;
    }
  }

  /**
   * Daily 20:00 nudge to log caffeine intake, only meant to be (re)scheduled
   * when the caller has already checked that nothing was logged today —
   * cancels any previous instance first so re-scheduling stays idempotent.
   */
  async scheduleCaffeineCheckInReminder(hour: number = 20, minute: number = 0): Promise<string | null> {
    try {
      await this.cancelCaffeineCheckInReminder();

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '☕ Cafeína',
          body: 'Hoy no has tomado cafeína. ¿Quieres registrarla?',
          data: { type: 'caffeine_checkin' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        } as Notifications.DailyTriggerInput,
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling caffeine check-in reminder:', error);
      return null;
    }
  }

  async cancelCaffeineCheckInReminder(): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

      for (const notification of scheduledNotifications) {
        const data = notification.content.data as any;
        if (data?.type === 'caffeine_checkin') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('Error canceling caffeine check-in reminder:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
