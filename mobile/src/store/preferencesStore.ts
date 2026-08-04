import { create } from 'zustand'

type ThemePreference = 'light' | 'system'
type LanguagePreference = 'en'

interface PreferencesState {
  theme: ThemePreference
  language: LanguagePreference
  setTheme: (theme: ThemePreference) => void
  setLanguage: (language: LanguagePreference) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: 'light',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}))
