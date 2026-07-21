import { useCallback, useMemo, useState } from 'react'
import { useSavedViewsStore, type SavedViewConfig } from '../store/savedViewsStore'

/** Stable fallback — never use inline `?? []` in Zustand selectors (new ref every render → infinite loop). */
const EMPTY_SAVED_VIEWS: SavedViewConfig[] = []

export interface UseSavedViewsOptions {
  /** Unique page key, e.g. `/sales/leads` */
  pageId: string
  /** Current filter state (search, stage, status, etc.) */
  filters: Record<string, string>
  /** Apply a saved filter snapshot to page state */
  onApply: (filters: Record<string, string>) => void
  /** Built-in preset snapshots keyed by view name */
  systemPresets?: Record<string, Record<string, string>>
}

/**
 * Standard saved-view behaviour for list pages:
 * 1. View dropdown lists system presets + user-saved custom views.
 * 2. Selecting a view restores its filter snapshot.
 * 3. Save View captures current filters under a name (persisted in localStorage).
 * 4. Re-saving an existing custom view name updates that view.
 */
export function useSavedViews({ pageId, filters, onApply, systemPresets = {} }: UseSavedViewsOptions) {
  const customViews = useSavedViewsStore((s) => s.customViews[pageId] ?? EMPTY_SAVED_VIEWS)
  const saveViewToStore = useSavedViewsStore((s) => s.saveView)
  const deleteViewFromStore = useSavedViewsStore((s) => s.deleteView)

  const [activeView, setActiveView] = useState<string>('My View')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [defaultView, setDefaultView] = useState<string>('My View')

  const viewNames = useMemo(() => {
    const system = Object.keys(systemPresets)
    const ordered = system.includes('My View')
      ? ['My View', ...system.filter((n) => n !== 'My View')]
      : system.length > 0
        ? system
        : ['My View']
    const custom = customViews
      .map((v) => v.name)
      .filter((n) => !ordered.includes(n))
    return [...ordered, ...custom]
  }, [customViews, systemPresets])

  const selectView = useCallback(
    (name: string) => {
      setActiveView(name)
      const custom = customViews.find((v) => v.name === name)
      if (custom) {
        onApply(custom.filters)
        return
      }
      const preset = systemPresets[name]
      if (preset) {
        onApply(preset)
        return
      }
      onApply(systemPresets['My View'] ?? {})
    },
    [customViews, onApply, systemPresets],
  )

  const openSaveDialog = useCallback(() => setSaveDialogOpen(true), [])
  const closeSaveDialog = useCallback(() => setSaveDialogOpen(false), [])

  const saveCurrentView = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return { ok: false as const, error: 'View name is required' }
      saveViewToStore(pageId, trimmed, filters)
      setActiveView(trimmed)
      setSaveDialogOpen(false)
      return { ok: true as const }
    },
    [filters, pageId, saveViewToStore],
  )

  const isCustomView = customViews.some((v) => v.name === activeView)

  const deleteView = useCallback(
    (name: string) => {
      deleteViewFromStore(pageId, name)
      if (activeView === name) {
        setActiveView(defaultView)
        selectView(defaultView)
      }
    },
    [activeView, defaultView, deleteViewFromStore, pageId, selectView],
  )

  const renameView = useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed || oldName === trimmed) return { ok: false as const, error: 'Invalid name' }
      const view = customViews.find((v) => v.name === oldName)
      if (!view) return { ok: false as const, error: 'View not found' }
      deleteViewFromStore(pageId, oldName)
      saveViewToStore(pageId, trimmed, view.filters)
      setActiveView(trimmed)
      return { ok: true as const }
    },
    [customViews, deleteViewFromStore, pageId, saveViewToStore],
  )

  const setAsDefaultView = useCallback((name: string) => {
    setDefaultView(name)
  }, [])

  /** Filters changed outside the View dropdown (chip remove, Clear all) — drop the stale view label. */
  const markFiltersCustomized = useCallback(() => {
    setActiveView('My View')
  }, [])

  return {
    activeView,
    viewNames,
    selectView,
    openSaveDialog,
    closeSaveDialog,
    saveDialogOpen,
    saveCurrentView,
    isCustomView,
    deleteView,
    renameView,
    setAsDefaultView,
    defaultView,
    markFiltersCustomized,
  }
}
