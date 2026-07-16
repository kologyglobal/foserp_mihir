import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QuickCreateContext, QuickCreateEntityType } from '../types/quickCreate'

export type LegacyDrawerType = 'po' | 'wo'
export type DrawerType = QuickCreateEntityType | LegacyDrawerType | null

export type DrawerState = QuickCreateContext | { legacyType: LegacyDrawerType; title: string }

export function isQuickCreateDrawer(drawer: DrawerState): drawer is QuickCreateContext {
  return 'entityType' in drawer
}

export interface NotificationItem {
  id: string
  type: 'approval' | 'qc' | 'delay' | 'shortage' | 'wo' | 'dispatch' | 'finance' | 'engineering'
  group?: 'approvals' | 'production' | 'quality' | 'purchase' | 'dispatch' | 'finance' | 'engineering'
  severity: 'green' | 'amber' | 'red'
  title: string
  description: string
  href?: string
  createdAt: string
  actionLabel?: string
}

export interface FavoritePage {
  path: string
  label: string
}

export interface RecentPage {
  path: string
  label: string
  visitedAt: string
}

export interface DetailPanelLink {
  label: string
  href: string
}

export interface DetailPanelTimelineEvent {
  id: string
  label: string
  time: string
  actor?: string
  status?: 'done' | 'current' | 'pending'
}

export interface DetailPanelState {
  title: string
  subtitle?: string
  fields: { label: string; value: string }[]
  timeline: DetailPanelTimelineEvent[]
  links: DetailPanelLink[]
  comments?: string
  aiSummary?: string
  attachments?: { name: string; size?: string }[]
  actions?: { label: string; onClick: () => void; primary?: boolean }[]
}

/** Debounce rapid duplicate visits (React Strict Mode / layout re-mounts). */
const recentTrackLog = new Map<string, number>()

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  closeMobileNav: () => void
  toggleMobileNav: () => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  notificationsOpen: boolean
  setNotificationsOpen: (open: boolean) => void
  drawer: DrawerState | null
  openDrawer: (
    type: NonNullable<DrawerType>,
    title: string,
    context?: Omit<QuickCreateContext, 'entityType' | 'title'>,
  ) => void
  closeDrawer: () => void
  favorites: FavoritePage[]
  toggleFavorite: (page: FavoritePage) => void
  isFavorite: (path: string) => boolean
  recentPages: RecentPage[]
  trackPageVisit: (page: Omit<RecentPage, 'visitedAt'>) => void
  detailPanelOpen: boolean
  detailPanel: DetailPanelState | null
  openDetailPanel: (panel: DetailPanelState) => void
  closeDetailPanel: () => void
  notificationReadIds: string[]
  notificationSnoozedUntil: Record<string, string>
  markNotificationRead: (id: string) => void
  snoozeNotification: (id: string, untilIso: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
      closeMobileNav: () => set((s) => (s.mobileNavOpen ? { mobileNavOpen: false } : s)),
      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),
      notificationsOpen: false,
      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
      drawer: null,
      openDrawer: (type, title, context) => {
        if (type === 'po' || type === 'wo') {
          set({ drawer: { legacyType: type, title } })
          return
        }
        set({
          drawer: {
            entityType: type,
            title,
            ...context,
          },
        })
      },
      closeDrawer: () => set({ drawer: null }),
      favorites: [],
      toggleFavorite: (page) =>
        set((s) => {
          const exists = s.favorites.some((f) => f.path === page.path)
          return {
            favorites: exists
              ? s.favorites.filter((f) => f.path !== page.path)
              : [...s.favorites, page].slice(0, 12),
          }
        }),
      isFavorite: (path) => get().favorites.some((f) => f.path === path),
      recentPages: [],
      trackPageVisit: (page) =>
        set((s) => {
          if (s.recentPages[0]?.path === page.path) {
            return s
          }
          const existing = s.recentPages.find((r) => r.path === page.path)
          if (existing) {
            const visitedMs = Date.parse(existing.visitedAt)
            if (!Number.isNaN(visitedMs) && Date.now() - visitedMs < 500) {
              const lastWarn = recentTrackLog.get(page.path) ?? 0
              if (Date.now() - lastWarn > 500) {
                console.warn('[ERP] trackPageVisit skipped — duplicate within 500ms:', page.path)
                recentTrackLog.set(page.path, Date.now())
              }
              return s
            }
          }
          const next = [
            { ...page, visitedAt: new Date().toISOString() },
            ...s.recentPages.filter((r) => r.path !== page.path),
          ].slice(0, 10)
          return { recentPages: next }
        }),
      detailPanelOpen: false,
      detailPanel: null,
      openDetailPanel: (panel) => set({ detailPanelOpen: true, detailPanel: panel }),
      closeDetailPanel: () => set({ detailPanelOpen: false, detailPanel: null }),
      notificationReadIds: [],
      notificationSnoozedUntil: {},
      markNotificationRead: (id) =>
        set((s) => ({
          notificationReadIds: s.notificationReadIds.includes(id) ? s.notificationReadIds : [...s.notificationReadIds, id],
        })),
      snoozeNotification: (id, untilIso) =>
        set((s) => ({
          notificationSnoozedUntil: { ...s.notificationSnoozedUntil, [id]: untilIso },
        })),
    }),
    {
      name: 'vasant-erp-ui',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        favorites: s.favorites,
        recentPages: s.recentPages,
        notificationReadIds: s.notificationReadIds,
        notificationSnoozedUntil: s.notificationSnoozedUntil,
      }),
    },
  ),
)
