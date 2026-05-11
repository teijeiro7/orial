import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { habitRepository } from '../repositories/habitRepository';
import type { Habit, HabitEntry } from '../../drizzle/schema';

interface HabitState {
  habits: Habit[];
  todayEntries: HabitEntry[];
  selectedHabit: Habit | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadHabits: () => Promise<void>;
  loadTodayEntries: () => Promise<void>;
  createHabit: (habit: Omit<Habit, 'id' | 'createdAt'>) => Promise<void>;
  toggleHabitToday: (habitId: string) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  selectHabit: (habit: Habit | null) => void;
  refresh: () => Promise<void>;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      todayEntries: [],
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

      createHabit: async (habitData) => {
        set({ isLoading: true, error: null });
        try {
          const newHabit: Habit = {
            ...habitData,
            id: crypto.randomUUID(),
            createdAt: new Date(),
          } as Habit;
          
          await habitRepository.createHabit(newHabit);
          await get().loadHabits();
        } catch (error) {
          set({ error: 'Failed to create habit', isLoading: false });
        }
      },

      toggleHabitToday: async (habitId) => {
        try {
          await habitRepository.toggleHabitEntry(habitId, new Date());
          await get().loadTodayEntries();
        } catch (error) {
          set({ error: 'Failed to toggle habit' });
        }
      },

      archiveHabit: async (habitId) => {
        try {
          await habitRepository.archiveHabit(habitId);
          await get().loadHabits();
        } catch (error) {
          set({ error: 'Failed to archive habit' });
        }
      },

      selectHabit: (habit) => {
        set({ selectedHabit: habit });
      },

      refresh: async () => {
        await get().loadHabits();
        await get().loadTodayEntries();
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
