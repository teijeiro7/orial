import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { OrialColors } from '../utils/colors';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface ReminderNotification {
  id: string;
  habitId: string;
  habitName: string;
  emoji: string;
  time: string; // HH:MM
  days: number[]; // [1,2,3,4,5] = Mon-Fri
}

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

  async scheduleHabitReminder(reminder: ReminderNotification): Promise<string | null> {
    try {
      const [hours, minutes] = reminder.time.split(':').map(Number);
      
      // Cancel existing notifications for this reminder
      await this.cancelReminder(reminder.id);

      // Schedule notification for each day
      const identifiers: string[] = [];
      
      for (const day of reminder.days) {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${reminder.emoji} ${reminder.habitName}`,
            body: 'Time to complete your habit!',
            data: {
              type: 'habit_reminder',
              habitId: reminder.habitId,
              reminderId: reminder.id,
            },
            sound: 'default',
            badge: 1,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day,
            hour: hours,
            minute: minutes,
          } as Notifications.WeeklyTriggerInput,
        });
        
        identifiers.push(identifier);
      }

      return identifiers[0] || null;
    } catch (error) {
      console.error('Error scheduling reminder:', error);
      return null;
    }
  }

  async scheduleStreakAtRiskNotification(habitId: string, habitName: string, emoji: string): Promise<string | null> {
    try {
      // Schedule for 23:30 today
      const now = new Date();
      const triggerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30);
      
      // If it's already past 23:30, schedule for tomorrow
      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${emoji} ${habitName}`,
          body: 'Your streak is at risk! Complete this habit before midnight.',
          data: {
            type: 'streak_at_risk',
            habitId,
          },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        } as Notifications.DateTriggerInput,
      });

      return identifier;
    } catch (error) {
      console.error('Error scheduling streak notification:', error);
      return null;
    }
  }

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

  async cancelReminder(reminderId: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        const data = notification.content.data as any;
        if (data?.reminderId === reminderId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('Error canceling reminder:', error);
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

  async cancelStreakAtRiskNotification(habitId: string): Promise<void> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      for (const notification of scheduledNotifications) {
        const data = notification.content.data as any;
        if (data?.type === 'streak_at_risk' && data?.habitId === habitId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('Error canceling streak notification:', error);
    }
  }
}

export const notificationService = NotificationService.getInstance();
