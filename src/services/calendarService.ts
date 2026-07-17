import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';
import { OrialColors } from '../utils/colors';

// expo-calendar no longer re-exports its `Event` type from the package root (SDK 57);
// derive it from getEventsAsync's return type instead.
type CalendarNativeEvent = Awaited<ReturnType<typeof Calendar.getEventsAsync>>[number];

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  recurrence?: string;
}

export interface DeviceCalendar {
  id: string;
  title: string;
  color: string;
  allowsModifications: boolean;
}

export class CalendarService {
  private static instance: CalendarService;
  private selectedCalendarId: string | null = null;

  static getInstance(): CalendarService {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }

  async getPermissionsStatus(): Promise<boolean> {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  }

  async getCalendars(): Promise<DeviceCalendar[]> {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      return calendars
        .filter(cal => cal.allowsModifications)
        .map(cal => ({
          id: cal.id,
          title: cal.title,
          color: cal.color || OrialColors.violet,
          allowsModifications: cal.allowsModifications,
        }));
    } catch (error) {
      console.error('Error getting calendars:', error);
      return [];
    }
  }

  setSelectedCalendar(calendarId: string): void {
    this.selectedCalendarId = calendarId;
  }

  getSelectedCalendar(): string | null {
    return this.selectedCalendarId;
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await Calendar.deleteEventAsync(eventId, { futureEvents: true });
    } catch (error) {
      console.error('Error deleting calendar event:', error);
    }
  }

  async updateEvent(
    eventId: string,
    updates: Partial<{
      title: string;
      startDate: Date;
      endDate: Date;
      notes: string;
    }>
  ): Promise<void> {
    try {
      await Calendar.updateEventAsync(eventId, updates);
    } catch (error) {
      console.error('Error updating calendar event:', error);
    }
  }

  async getEventsForDate(date: Date): Promise<CalendarNativeEvent[]> {
    if (!this.selectedCalendarId) return [];

    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

      const events = await Calendar.getEventsAsync(
        [this.selectedCalendarId],
        startOfDay,
        endOfDay
      );

      return events;
    } catch (error) {
      console.error('Error getting events:', error);
      return [];
    }
  }

  async getEventsForMonth(year: number, month: number): Promise<CalendarNativeEvent[]> {
    if (!this.selectedCalendarId) return [];

    try {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const events = await Calendar.getEventsAsync(
        [this.selectedCalendarId],
        startOfMonth,
        endOfMonth
      );

      return events;
    } catch (error) {
      console.error('Error getting month events:', error);
      return [];
    }
  }
}

export const calendarService = CalendarService.getInstance();
