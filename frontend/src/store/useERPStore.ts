import { create } from 'zustand'
import { salesOrders } from '@/data/sales/legacyDemo'
import { materialShortages } from '@/data/inventory/legacyDemo'
import { workOrders } from '@/data/production/legacyDemo'
import { dispatchOrders } from '@/data/dispatch/legacyDemo'
import { qcInspections } from '@/data/quality/legacyDemo'
import type { DashboardKPI } from '../types/erp'

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

interface ERPState {
  kpis: DashboardKPI
  refreshKPIs: () => void
}

function computeKPIs(): DashboardKPI {
  const openOrders = salesOrders.filter(
    (o) => !['dispatched', 'closed'].includes(o.status),
  ).length

  const productionWIP = workOrders.filter(
    (w) => w.status === 'in-progress' || w.status === 'released',
  ).length

  const dispatchReady = dispatchOrders.filter((d) => d.status === 'ready').length

  const pendingQC = qcInspections.filter(
    (q) => q.status === 'pending' || q.status === 'in-progress',
  ).length

  return {
    openOrders,
    materialShortages: materialShortages.length,
    productionWIP,
    dispatchReady,
    pendingQC,
  }
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))

export const useERPStore = create<ERPState>(() => ({
  kpis: computeKPIs(),
  refreshKPIs: () => {},
}))

useERPStore.setState({ refreshKPIs: () => useERPStore.setState({ kpis: computeKPIs() }) })
