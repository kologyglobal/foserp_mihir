import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isApiMode } from '../config/apiConfig'
import { erpStorage, ERP_PERSIST_VERSION } from './persistConfig'
import * as api from '../services/api/executiveDashboardApi'
import { formatApiError } from '../services/api/apiErrors'
import {
  buildTemplateWidgets,
  EXECUTIVE_WIDGET_CATALOG,
} from '../modules/executive/executiveWidgetCatalog'
import type {
  DashboardGlobalFilters,
  DashboardTemplateKey,
  DashboardWidgetDefinition,
  DashboardWidgetLayout,
  ExecutiveDashboardDto,
  WidgetVisualization,
} from '../types/executiveDashboard'

const STORAGE_KEY = 'vasant-erp-ceo-dashboards-v1'

interface ExecutiveDashboardState {
  dashboards: ExecutiveDashboardDto[]
  catalog: DashboardWidgetDefinition[]
  activeDashboardId: string | null
  editing: boolean
  globalFilters: DashboardGlobalFilters
  loading: boolean
  error: string | null

  hydrate: () => Promise<void>
  setEditing: (v: boolean) => void
  setGlobalFilters: (patch: Partial<DashboardGlobalFilters>) => void
  setActiveDashboard: (id: string) => void
  createDashboard: (name: string, templateKey: DashboardTemplateKey) => Promise<string | null>
  renameDashboard: (id: string, name: string) => Promise<void>
  duplicateDashboard: (id: string) => Promise<string | null>
  setDefault: (id: string) => Promise<void>
  deleteDashboard: (id: string) => Promise<void>
  saveActiveLayout: (widgets: DashboardWidgetLayout[]) => Promise<void>
  addWidget: (widgetKey: string, visualization?: WidgetVisualization) => void
  removeWidget: (widgetId: string) => void
  updateWidgetLayout: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void
  updateWidgetConfig: (widgetId: string, patch: Partial<DashboardWidgetLayout>) => void
  getActive: () => ExecutiveDashboardDto | null
}

function localId() {
  return crypto.randomUUID()
}

function seedLocalDashboard(): ExecutiveDashboardDto {
  return {
    id: localId(),
    name: 'CEO Overview',
    description: 'Default executive cockpit',
    isDefault: true,
    isShared: false,
    widgets: buildTemplateWidgets('ceo_overview'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const useExecutiveDashboardStore = create<ExecutiveDashboardState>()(
  persist(
    (set, get) => ({
      dashboards: [],
      catalog: EXECUTIVE_WIDGET_CATALOG,
      activeDashboardId: null,
      editing: false,
      globalFilters: { datePreset: 'this_month', compareWith: 'previous_period' },
      loading: false,
      error: null,

      getActive: () => {
        const { dashboards, activeDashboardId } = get()
        return dashboards.find((d) => d.id === activeDashboardId) ?? dashboards.find((d) => d.isDefault) ?? dashboards[0] ?? null
      },

      hydrate: async () => {
        set({ loading: true, error: null })
        try {
          if (isApiMode()) {
            try {
              const [dashRes, catRes] = await Promise.all([
                api.fetchExecutiveDashboards(),
                api.fetchExecutiveWidgetCatalog().catch(() => ({ data: EXECUTIVE_WIDGET_CATALOG })),
              ])
              let dashboards = dashRes.data ?? []
              if (!dashboards.length) {
                const created = await api.createExecutiveDashboard({
                  name: 'CEO Overview',
                  templateKey: 'ceo_overview',
                  isDefault: true,
                })
                dashboards = [created.data]
              }
              const active = dashboards.find((d) => d.isDefault) ?? dashboards[0]
              set({
                dashboards,
                catalog: catRes.data?.length ? catRes.data : EXECUTIVE_WIDGET_CATALOG,
                activeDashboardId: active?.id ?? null,
                loading: false,
              })
            } catch (apiErr) {
              // API not ready / no permission — fall back to local builder so CEO can still customize
              let { dashboards } = get()
              if (!dashboards.length) dashboards = [seedLocalDashboard()]
              set({
                dashboards,
                catalog: EXECUTIVE_WIDGET_CATALOG,
                activeDashboardId: dashboards.find((d) => d.isDefault)?.id ?? dashboards[0].id,
                loading: false,
                error: formatApiError(apiErr),
              })
            }
          } else {
            let { dashboards } = get()
            if (!dashboards.length) {
              dashboards = [seedLocalDashboard()]
            }
            set({
              dashboards,
              catalog: EXECUTIVE_WIDGET_CATALOG,
              activeDashboardId: dashboards.find((d) => d.isDefault)?.id ?? dashboards[0].id,
              loading: false,
            })
          }
        } catch (e) {
          set({ loading: false, error: formatApiError(e) })
        }
      },

      setEditing: (v) => set({ editing: v }),
      setGlobalFilters: (patch) => set((s) => ({ globalFilters: { ...s.globalFilters, ...patch } })),
      setActiveDashboard: (id) => set({ activeDashboardId: id, editing: false }),

      createDashboard: async (name, templateKey) => {
        if (isApiMode()) {
          try {
            const res = await api.createExecutiveDashboard({ name, templateKey })
            set((s) => ({
              dashboards: [res.data, ...s.dashboards],
              activeDashboardId: res.data.id,
            }))
            return res.data.id
          } catch (e) {
            set({ error: formatApiError(e) })
            return null
          }
        }
        const d: ExecutiveDashboardDto = {
          id: localId(),
          name,
          description: null,
          isDefault: false,
          isShared: false,
          widgets: buildTemplateWidgets(templateKey),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ dashboards: [d, ...s.dashboards], activeDashboardId: d.id }))
        return d.id
      },

      renameDashboard: async (id, name) => {
        if (isApiMode()) {
          const res = await api.updateExecutiveDashboard(id, { name })
          set((s) => ({ dashboards: s.dashboards.map((d) => (d.id === id ? res.data : d)) }))
          return
        }
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d,
          ),
        }))
      },

      duplicateDashboard: async (id) => {
        if (isApiMode()) {
          const res = await api.duplicateExecutiveDashboard(id)
          set((s) => ({ dashboards: [res.data, ...s.dashboards], activeDashboardId: res.data.id }))
          return res.data.id
        }
        const src = get().dashboards.find((d) => d.id === id)
        if (!src) return null
        const copy: ExecutiveDashboardDto = {
          ...src,
          id: localId(),
          name: `${src.name} (copy)`,
          isDefault: false,
          widgets: src.widgets.map((w) => ({ ...w, id: localId() })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ dashboards: [copy, ...s.dashboards], activeDashboardId: copy.id }))
        return copy.id
      },

      setDefault: async (id) => {
        if (isApiMode()) {
          const res = await api.setDefaultExecutiveDashboard(id)
          set((s) => ({
            dashboards: s.dashboards.map((d) =>
              d.id === id ? res.data : { ...d, isDefault: false },
            ),
          }))
          return
        }
        set((s) => ({
          dashboards: s.dashboards.map((d) => ({ ...d, isDefault: d.id === id })),
        }))
      },

      deleteDashboard: async (id) => {
        if (isApiMode()) {
          await api.deleteExecutiveDashboard(id)
        }
        set((s) => {
          const dashboards = s.dashboards.filter((d) => d.id !== id)
          return {
            dashboards,
            activeDashboardId: s.activeDashboardId === id ? dashboards[0]?.id ?? null : s.activeDashboardId,
          }
        })
      },

      saveActiveLayout: async (widgets) => {
        const active = get().getActive()
        if (!active) return
        if (isApiMode()) {
          const res = await api.updateExecutiveDashboard(active.id, { widgets })
          set((s) => ({
            dashboards: s.dashboards.map((d) => (d.id === active.id ? res.data : d)),
            editing: false,
          }))
          return
        }
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === active.id ? { ...d, widgets, updatedAt: new Date().toISOString() } : d,
          ),
          editing: false,
        }))
      },

      addWidget: (widgetKey, visualization) => {
        const def = get().catalog.find((c) => c.key === widgetKey) ?? EXECUTIVE_WIDGET_CATALOG.find((c) => c.key === widgetKey)
        if (!def) return
        const active = get().getActive()
        if (!active) return
        const maxY = active.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
        const widget: DashboardWidgetLayout = {
          id: localId(),
          widgetKey,
          x: 0,
          y: maxY,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
          visualization: visualization ?? def.supportedVisualizations[0] ?? 'KPI',
        }
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === active.id ? { ...d, widgets: [...d.widgets, widget] } : d,
          ),
        }))
      },

      removeWidget: (widgetId) => {
        const active = get().getActive()
        if (!active) return
        set((s) => ({
          dashboards: s.dashboards.map((d) =>
            d.id === active.id ? { ...d, widgets: d.widgets.filter((w) => w.id !== widgetId) } : d,
          ),
        }))
      },

      updateWidgetLayout: (layouts) => {
        const active = get().getActive()
        if (!active) return
        const map = new Map(layouts.map((l) => [l.i, l]))
        set((s) => ({
          dashboards: s.dashboards.map((d) => {
            if (d.id !== active.id) return d
            return {
              ...d,
              widgets: d.widgets.map((w) => {
                const l = map.get(w.id)
                return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
              }),
            }
          }),
        }))
      },

      updateWidgetConfig: (widgetId, patch) => {
        const active = get().getActive()
        if (!active) return
        set((s) => ({
          dashboards: s.dashboards.map((d) => {
            if (d.id !== active.id) return d
            return {
              ...d,
              widgets: d.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)),
            }
          }),
        }))
      },
    }),
    {
      name: STORAGE_KEY,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) =>
        isApiMode()
          ? {}
          : {
              dashboards: s.dashboards,
              activeDashboardId: s.activeDashboardId,
              globalFilters: s.globalFilters,
            },
    },
  ),
)
