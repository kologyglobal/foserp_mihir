import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SavedViewConfig {
  name: string
  filters: Record<string, string>
  updatedAt: string
}

const EMPTY_SAVED_VIEWS: SavedViewConfig[] = []

interface SavedViewsState {
  /** pageId → user-saved views */
  customViews: Record<string, SavedViewConfig[]>
  saveView: (pageId: string, name: string, filters: Record<string, string>) => void
  getViewsForPage: (pageId: string) => SavedViewConfig[]
  deleteView: (pageId: string, name: string) => void
}

export const useSavedViewsStore = create<SavedViewsState>()(
  persist(
    (set, get) => ({
      customViews: {},

      getViewsForPage: (pageId) => get().customViews[pageId] ?? EMPTY_SAVED_VIEWS,

      saveView: (pageId, name, filters) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const now = new Date().toISOString()
        set((s) => {
          const existing = s.customViews[pageId] ?? []
          const idx = existing.findIndex((v) => v.name === trimmed)
          const entry: SavedViewConfig = { name: trimmed, filters: { ...filters }, updatedAt: now }
          const next =
            idx >= 0
              ? existing.map((v, i) => (i === idx ? entry : v))
              : [...existing, entry]
          return { customViews: { ...s.customViews, [pageId]: next } }
        })
      },

      deleteView: (pageId, name) => {
        set((s) => ({
          customViews: {
            ...s.customViews,
            [pageId]: (s.customViews[pageId] ?? []).filter((v) => v.name !== name),
          },
        }))
      },
    }),
    { name: 'vasant-erp-saved-views' },
  ),
)
