import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
    }),
    {
      name: 'orial-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
