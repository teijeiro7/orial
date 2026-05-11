import { NativeModules, Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { useHabitStore } from '../stores/habitStore';

const SHARED_PREFS_NAME = 'orial_widget_data';
const GROUP_ID = 'group.com.orial.app.widget';

export interface WidgetData {
  date: string;
  completedCount: number;
  totalCount: number;
  habits: {
    id: string;
    name: string;
    emoji: string;
    completed: boolean;
    category: string;
  }[];
  streakCount: number;
}

export class WidgetService {
  private static instance: WidgetService;

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  async updateWidgetData(): Promise<void> {
    try {
      const { habits, todayEntries } = useHabitStore.getState();
      
      const completedCount = habits.filter(h => 
        todayEntries.some(e => e.habitId === h.id && e.completed)
      ).length;

      const widgetData: WidgetData = {
        date: new Date().toISOString(),
        completedCount,
        totalCount: habits.length,
        habits: habits.map(habit => ({
          id: habit.id,
          name: habit.name,
          emoji: habit.emoji,
          completed: todayEntries.some(e => e.habitId === habit.id && e.completed),
          category: habit.category,
        })),
        streakCount: this.calculateTotalStreaks(),
      };

      // Save to shared preferences for widgets
      if (Platform.OS === 'ios') {
        // iOS: Use App Groups via DefaultPreference
        await DefaultPreference.setName(GROUP_ID);
        await DefaultPreference.set('widget_data', JSON.stringify(widgetData));
      } else {
        // Android: Use SharedPreferences
        await DefaultPreference.setName(SHARED_PREFS_NAME);
        await DefaultPreference.set('widget_data', JSON.stringify(widgetData));
      }

      // Reload widgets
      this.reloadWidgets();
    } catch (error) {
      console.error('Error updating widget data:', error);
    }
  }

  private calculateTotalStreaks(): number {
    // Simplified streak calculation for widget
    // In production, this would use the actual streak calculator
    return 5; // Placeholder
  }

  private reloadWidgets(): void {
    if (Platform.OS === 'ios') {
      // On iOS, widgets auto-update when timeline reloads
      // We can force reload via NativeModules if needed
      try {
        const { WidgetManager } = NativeModules;
        if (WidgetManager?.reloadAllTimelines) {
          WidgetManager.reloadAllTimelines();
        }
      } catch {
        // WidgetManager not available
      }
    }
    // On Android, widgets update via broadcast or on their own schedule
  }
}

export const widgetService = WidgetService.getInstance();
