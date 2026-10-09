import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TranslationCode = 'KJV' | 'ADB' | 'CEB';
export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsState {
  translationCode: TranslationCode;
  fontScale: number;
  theme: ThemePreference;
  hasCompletedOnboarding: boolean;
  setTranslation: (code: TranslationCode) => void;
  setFontScale: (scale: number) => void;
  setTheme: (theme: ThemePreference) => void;
  completeOnboarding: () => void;
}

/**
 * Global user preferences, persisted locally via AsyncStorage (local-first).
 * Rehydrates automatically on launch; components read it with a selector, e.g.
 *   const code = useSettingsStore((s) => s.translationCode);
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      translationCode: 'KJV',
      fontScale: 1,
      theme: 'system',
      hasCompletedOnboarding: false,
      setTranslation: (translationCode) => set({ translationCode }),
      setFontScale: (fontScale) => set({ fontScale }),
      setTheme: (theme) => set({ theme }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: 'smartbible-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
