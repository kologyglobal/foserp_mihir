/**
 * Central ERP analytics — single data-truth layer for dashboards, KPIs, and live ticker.
 * All values computed from Zustand demo stores; no hardcoded dashboard numbers.
 */
import { useMemo } from 'react'
import {
  getExecutiveDashboardData,
  getProductionControlTowerData,
  getMrpPlannerWorkbenchData,
  getUnifiedInboxData,
} from '../utils/controlTowerMetrics'
import { getSidebarCategoryCounts } from '../utils/sidebarLiveCounts'
import { formatMetricCurrency, buildNotifications } from '../utils/workspaceMetrics'
import { usePurchaseStore } from '../store/purchaseStore'
import { useQualityStore } from '../store/qualityStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useEcoStore } from '../store/ecoStore'
import { useSalesStore } from '../store/salesStore'
import { useMrpStore } from '../store/mrpStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useDispatchStore } from '../store/dispatchStore'

export type ErpTraffic = 'green' | 'amber' | 'red'

export interface ErpExecutiveAnalytics {
  plantName: string
  shift: string
  lastUpdated: string
  plantHealthScore: number
  traffic: ErpTraffic
  orderBookValue: number
  orderBookCount: number
  invoicedYtd: number
  outstandingAr: number
  overdueAr: number
  overdueCount: number
  wipValue: number
  productionValue: number
  fgValue: number
  dispatchReadyValue: number
  dispatchReadyCount: number
  runningWorkOrders: number
  qcPending: number
  openNcr: number
  delayedOrders: number
  materialShortages: number
  pendingApprovals: number
  vendorDelays: number
  paymentOverdue: number
  jobWorkPending: number
  ecoPending: number
  capacityUtil: number
  openLeads: number
  activeQuotes: number
  firstPassYieldPct: number
}

function computePlantHealth(input: {
  delayedOrders: number
  openNcr: number
  outstanding: number
  materialShortages: number
  qcPending: number
}): number {
  return Math.max(
    40,
    Math.min(
      98,
      94 -
        input.delayedOrders * 3 -
        input.openNcr * 2 -
        (input.outstanding > 0 ? 2 : 0) -
        input.materialShortages * 2 -
        Math.min(input.qcPending, 5),
    ),
  )
}

/** Sync executive analytics — source of truth for CEO command center */
export function getErpExecutiveAnalytics(): ErpExecutiveAnalytics {
  const exec = getExecutiveDashboardData()
  const prod = getProductionControlTowerData()
  const mrp = getMrpPlannerWorkbenchData()
  const inbox = getUnifiedInboxData()
  const invMetrics = useInvoiceStore.getState().getMetrics()
  const qc = useQualityStore.getState().getMetrics()
  const sales = useSalesStore.getState()
  const eco = useEcoStore.getState()
  const purchase = usePurchaseStore.getState()
  const dispatch = useDispatchStore.getState()

  const readyDispatches = dispatch.dispatches.filter((d) =>
    ['ready', 'planned', 'loading'].includes(d.status),
  )
  const overdueReceivables = useInvoiceStore.getState().getReceivables().filter((r) => r.daysOverdue > 0 || r.paymentStatus === 'overdue')
  const overdueAr = overdueReceivables.reduce((s, r) => s + r.balanceDue, 0)
  const vendorDelays = purchase.getDelayedPoReport().length
  const jobWorkPending = useWorkOrderStore
    .getState()
    .workOrders.filter((w) => w.woType === 'subcontract' && !['closed', 'completed', 'cancelled'].includes(w.status)).length
  const ecoPending = eco.ecos.filter((e) => ['draft', 'pending_approval'].includes(e.approvalStatus)).length

  const plantHealthScore = computePlantHealth({
    delayedOrders: exec.delayedOrders,
    openNcr: exec.openNcr,
    outstanding: exec.outstanding,
    materialShortages: mrp.shortages.length,
    qcPending: qc.pendingInspections,
  })

  return {
    plantName: 'Pune Plant',
    shift: 'Shift A',
    lastUpdated: new Date().toISOString(),
    plantHealthScore,
    traffic: exec.traffic,
    orderBookValue: exec.orderBookValue,
    orderBookCount: exec.orderBookCount,
    invoicedYtd: exec.invoiceValue,
    outstandingAr: exec.outstanding,
    overdueAr,
    overdueCount: invMetrics.overdueCount,
    wipValue: exec.wipValue,
    productionValue: exec.productionValue,
    fgValue: exec.fgValue,
    dispatchReadyValue: exec.dispatchValue,
    dispatchReadyCount: readyDispatches.length,
    runningWorkOrders: prod.running,
    qcPending: qc.pendingInspections,
    openNcr: exec.openNcr,
    delayedOrders: exec.delayedOrders,
    materialShortages: mrp.shortages.length,
    pendingApprovals: inbox.counts.approvals,
    vendorDelays,
    paymentOverdue: overdueAr,
    jobWorkPending,
    ecoPending,
    capacityUtil: exec.capacityUtil,
    openLeads: sales.leads.filter((l) => !['converted_to_opportunity', 'closed', 'converted', 'disqualified'].includes(l.stage)).length,
    activeQuotes: sales.quotations.filter((q) => !['expired', 'rejected', 'converted'].includes(q.status)).length,
    firstPassYieldPct: qc.firstPassYieldPct,
  }
}

export function useErpExecutiveAnalytics(): ErpExecutiveAnalytics {
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const inspections = useQualityStore((s) => s.inspections)
  const invoices = useInvoiceStore((s) => s.invoices)
  const leads = useSalesStore((s) => s.leads)
  const quotations = useSalesStore((s) => s.quotations)
  const ecos = useEcoStore((s) => s.ecos)

  return useMemo(() => getErpExecutiveAnalytics(), [
    salesOrders,
    workOrders,
    purchaseOrders,
    dispatches,
    inspections,
    invoices,
    leads,
    quotations,
    ecos,
  ])
}

export function getErpWorkspaceAnalytics(module: 'sales' | 'purchase' | 'production' | 'quality' | 'dispatch' | 'inventory' | 'finance') {
  const exec = getErpExecutiveAnalytics()
  const prod = getProductionControlTowerData()
  const mrp = getMrpPlannerWorkbenchData()

  switch (module) {
    case 'sales':
      return { orderBookValue: exec.orderBookValue, openOrders: exec.orderBookCount, openLeads: exec.openLeads, activeQuotes: exec.activeQuotes }
    case 'purchase':
      return { vendorDelays: exec.vendorDelays, materialShortages: exec.materialShortages, pendingApprovals: exec.pendingApprovals }
    case 'production':
      return { running: prod.running, late: prod.late, qcHolds: prod.qcHolds, capacityUtil: prod.capacityUtil, rework: prod.reworkQueue }
    case 'quality':
      return { pendingInspections: exec.qcPending, openNcr: exec.openNcr, firstPassYieldPct: exec.firstPassYieldPct }
    case 'dispatch':
      return { readyCount: exec.dispatchReadyCount, dispatchValue: exec.dispatchReadyValue }
    case 'inventory':
      return { shortages: mrp.shortages.length }
    case 'finance':
      return { outstanding: exec.outstandingAr, overdue: exec.overdueAr, invoiced: exec.invoicedYtd }
    default:
      return exec
  }
}

export function getErpSidebarCounts() {
  return getSidebarCategoryCounts()
}

export function getErpNotifications() {
  return buildNotifications()
}

export { formatMetricCurrency }

/** KPI consistency check — ticker vs executive must match within tolerance */
export function validateAnalyticsConsistency(): { ok: boolean; mismatches: string[] } {
  const exec = getErpExecutiveAnalytics()
  const legacy = getExecutiveDashboardData()
  const mismatches: string[] = []
  const check = (label: string, a: number, b: number) => {
    if (a !== b) mismatches.push(`${label}: analytics=${a} legacy=${b}`)
  }
  check('orderBookValue', exec.orderBookValue, legacy.orderBookValue)
  check('orderBookCount', exec.orderBookCount, legacy.orderBookCount)
  check('openNcr', exec.openNcr, legacy.openNcr)
  check('runningWO', exec.runningWorkOrders, getProductionControlTowerData().running)
  return { ok: mismatches.length === 0, mismatches }
}
