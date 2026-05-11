import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { habitRepository } from '../repositories/habitRepository';
import { notificationService } from '../services/notificationService';
import { syncQueueWorker } from '../services/syncQueueWorker';
import type { Habit, HabitEntry, Reminder } from '../../drizzle/schema';

interface HabitState {
  habits: Habit[];
  todayEntries: HabitEntry[];
  reminders: Reminder[];
  selectedHabit: Habit | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadHabits: () => Promise<void>;
  loadTodayEntries: () => Promise<void>;
  loadReminders: () => Promise<void>;
  createHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Promise<void>;
  toggleHabitToday: (habitId: string) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  createReminder: (reminder: Omit<Reminder, 'id'>) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  selectHabit: (habit: Habit | null) => void;
  refresh: () => Promise<void>;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      todayEntries: [],
      reminders: [],
      selectedHabit: null,
      isLoading: false,
      error: null,

      loadHabits: async () => {
        set({ isLoading: true, error: null });
        try {
          const habits = await habitRepository.getActiveHabits();
          set({ habits, isLoading: false });
        } catch (error) {
          set({ error: 'Failed to load habits', isLoading: false });
        }
      },

      loadTodayEntries: async () => {
        try {
          const entries = await habitRepository.getTodayEntries();
          set({ todayEntries: entries });
        } catch (error) {
          set({ error: 'Failed to load today entries' });
        }
      },

      loadReminders: async () => {
        try {
          const reminders = await habitRepository.getActiveReminders();
          set({ reminders });
        } catch (error) {
          set({ error: 'Failed to load reminders' });
        }
      },

      createHabit: async (habitData) => {
        set({ isLoading: true, error: null });
        try {
          const newHabit: Habit = {
            ...habitData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
          } as Habit;
          
          await habitRepository.createHabit(newHabit);
          
          // Add to sync queue
          await syncQueueWorker.addToQueue('create', 'habit', newHabit.id, {
            name: newHabit.name,
            emoji: newHabit.emoji,
            category: newHabit.category,
            frequency: newHabit.frequency,
            targetDays: newHabit.targetDays,
            targetCount: newHabit.targetCount,
            isArchived: newHabit.isArchived,
            createdAt: newHabit.createdAt.toISOString(),
          });
          
          await get().loadHabits();
        } catch (error) {
          set({ error: 'Failed to create habit', isLoading: false });
        }
      },

      toggleHabitToday: async (habitId) => {
        try {
          await habitRepository.toggleHabitEntry(habitId, new Date());
          
          // Get the updated entry
          const entries = await habitRepository.getTodayEntries();
          const entry = entries.find(e => e.habitId === habitId);
          
          if (entry) {
            // Add to sync queue
            await syncQueueWorker.addToQueue('create', 'entry', entry.id, {
              date: entry.date.toISOString(),
              habitId: habitId,
              completed: entry.completed,
              note: entry.note,
            });
          }
          
          await get().loadTodayEntries();
        } catch (error) {
          set({ error: 'Failed to toggle habit' });
        }
      },

      archiveHabit: async (habitId) => {
        try {
          await habitRepository.archiveHabit(habitId);
          
          // Add to sync queue
          const habit = get().habits.find(h => h.id === habitId);
          if (habit?.notionPageId) {
            await syncQueueWorker.addToQueue('update', 'habit', habitId, {
              notionPageId: habit.notionPageId,
              name: habit.name,
              emoji: habit.emoji,
              category: habit.category,
              frequency: habit.frequency,
              isArchived: true,
            });
          }
          
          await get().loadHabits();
        } catch (error) {
          set({ error: 'Failed to archive habit' });
        }
      },

      createReminder: async (reminderData) => {
        try {
          const newReminder: Reminder = {
            ...reminderData,
            id: crypto.randomUUID(),
          } as Reminder;
          
          await habitRepository.createReminder(newReminder);
          
          // Schedule notification
          const habit = get().habits.find(h => h.id === reminderData.habitId);
          if (habit) {
            await notificationService.scheduleHabitReminder({
              id: newReminder.id,
              habitId: habit.id,
              habitName: habit.name,
              emoji: habit.emoji,
              time: reminderData.time,
              days: JSON.parse(reminderData.days),
            });
          }
          
          await get().loadReminders();
        } catch (error) {
          set({ error: 'Failed to create reminder' });
        }
      },

      deleteReminder: async (reminderId) => {
        try {
          await notificationService.cancelReminder(reminderId);
          await habitRepository.deleteReminder(reminderId);
          await get().loadReminders();
        } catch (error) {
          set({ error: 'Failed to delete reminder' });
        }
      },

      selectHabit: (habit) => {
        set({ selectedHabit: habit });
      },

      refresh: async () => {
        await get().loadHabits();
        await get().loadTodayEntries();
        await get().loadReminders();
      },
    }),
    {
      name: 'orial-habit-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        selectedHabit: state.selectedHabit 
      }),
    }
  )
);
