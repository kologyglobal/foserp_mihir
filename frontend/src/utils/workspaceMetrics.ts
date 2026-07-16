import { useMemo } from 'react'
import { usePurchaseStore } from '../store/purchaseStore'
import { useSalesStore } from '../store/salesStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useMasterStore } from '../store/masterStore'
import { crmQuotationPath } from './crmQuotationNavigation'
import type { NotificationItem } from '../store/uiStore'
import { formatCurrency } from './formatters/currency'
export function buildNotifications(): NotificationItem[] {
  const items: NotificationItem[] = []
  const now = new Date().toISOString()

  const pendingPr = usePurchaseStore.getState().getPendingPrReport()
  for (const pr of pendingPr.filter((p) => p.status === 'submitted').slice(0, 3)) {
    items.push({
      id: `pr-${pr.prNo}`,
      type: 'approval',
      group: 'approvals',
      severity: 'amber',
      title: `PR ${pr.prNo} awaiting approval`,
      description: `${pr.lineCount} lines · ${pr.source}`,
      href: `/purchase/requisitions/${pr.prId}`,
      createdAt: now,
      actionLabel: 'Review',
    })
  }

  const pendingQuotes = useSalesStore.getState().getPendingCustomerApprovals()
  for (const q of pendingQuotes.slice(0, 2)) {
    items.push({
      id: `quo-${q.id}`,
      type: 'approval',
      group: 'approvals',
      severity: 'amber',
      title: `Quotation ${q.quotationNo} needs customer approval`,
      description: `Rev ${q.revisionNo}`,
      href: crmQuotationPath(q.id),
      createdAt: now,
    })
  }

  const delayedPo = usePurchaseStore.getState().getDelayedPoReport()
  for (const po of delayedPo.slice(0, 3)) {
    items.push({
      id: `dpo-${po.poNo}`,
      type: 'delay',
      group: 'purchase',
      severity: 'red',
      title: `Delayed PO ${po.poNo}`,
      description: `Expected ${po.expectedDate} · ${po.vendorName}`,
      href: `/purchase/orders/${po.poId}`,
      createdAt: now,
    })
  }

  const qc = useQualityStore.getState().getMetrics()
  if (qc.pendingInspections > 0) {
    items.push({
      id: 'qc-pending',
      type: 'qc',
      group: 'quality',
      severity: 'amber',
      title: `${qc.pendingInspections} pending QC inspections`,
      description: 'Shop floor / in-process queue',
      href: '/quality/queue',
      createdAt: now,
    })
  }
  if (qc.openNcr > 0) {
    items.push({
      id: 'ncr-open',
      type: 'qc',
      group: 'quality',
      severity: qc.ncrAgeingOver7Days > 0 ? 'red' : 'amber',
      title: `${qc.openNcr} open NCR(s)`,
      description: qc.ncrAgeingOver7Days > 0 ? `${qc.ncrAgeingOver7Days} ageing over 7 days` : 'Quality review required',
      href: '/quality/ncr',
      createdAt: now,
    })
  }

  const mrp = useMrpStore.getState().getDashboardSummary()
  if (mrp.materialShortages > 0) {
    items.push({
      id: 'mrp-shortage',
      type: 'shortage',
      group: 'production',
      severity: 'red',
      title: `${mrp.materialShortages} material shortage(s)`,
      description: 'MRP flagged items below requirement',
      href: '/mrp',
      createdAt: now,
    })
  }

  const lateWos = useWorkOrderStore.getState().workOrders.filter(
    (w) => !['closed', 'completed', 'cancelled'].includes(w.status) && w.plannedFinishDate && w.plannedFinishDate < new Date().toISOString().slice(0, 10),
  )
  for (const wo of lateWos.slice(0, 3)) {
    items.push({
      id: `wo-${wo.id}`,
      type: 'wo',
      group: 'production',
      severity: 'red',
      title: `Overdue WO ${wo.woNo}`,
      description: `Planned finish ${wo.plannedFinishDate}`,
      href: `/work-orders/${wo.id}`,
      createdAt: now,
    })
  }

  return [...items].sort((a, b) => (a.severity === 'red' ? -1 : b.severity === 'red' ? 1 : 0))
}

/** Reactive notifications without writing derived arrays into uiStore (avoids render loops). */
export function useNotifications(): NotificationItem[] {
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const quotations = useSalesStore((s) => s.quotations)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  const mrpRuns = useMrpStore((s) => s.runs)

  return useMemo(
    () => buildNotifications(),
    [requisitions, purchaseOrders, quotations, workOrders, inspections, reworks, ncrs, mrpRuns],
  )
}

export function useExecutiveMetrics() {
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  const mrpRuns = useMrpStore((s) => s.runs)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const reservations = useInventoryStore((s) => s.reservations)
  const items = useMasterStore((s) => s.items)

  return useMemo(() => {
    const qc = useQualityStore.getState().getMetrics()
    const mrp = useMrpStore.getState().getDashboardSummary()
    const stock = useInventoryStore.getState().getStockPositions()
    const getItem = useMasterStore.getState().getItem

    const openOrders = salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status))
    const orderBookValue = openOrders.reduce((s, o) => s + (o.grandTotal ?? 0), 0)

    const activeWos = workOrders.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status))
    const productionValue = activeWos.reduce((s, w) => s + (w.qty * (getItem(w.fgItemId)?.standardRate ?? 0)), 0)

    const openPos = purchaseOrders.filter((p) => !['closed', 'cancelled'].includes(p.status))
    const purchaseCommitments = openPos.reduce(
      (s, po) => s + po.lines.reduce((ls, l) => ls + l.qty * l.rate, 0),
      0,
    )

    const dispatchValue = dispatches
      .filter((d) => !['delivered', 'cancelled'].includes(d.status))
      .reduce((s, d) => s + d.lines.reduce((ls, l) => ls + l.qty, 0), 0)

    const inventoryValue = stock.reduce((s, pos) => {
      const rate = getItem(pos.itemId)?.standardRate ?? 0
      return s + pos.onHand * rate
    }, 0)

    const delayedOrders = mrp.delayedMaterials + usePurchaseStore.getState().getDelayedPoReport().length

    const runningWos = workOrders.filter((w) => w.status === 'in_production').length
    const capacityUtil = activeWos.length > 0 ? Math.min(100, Math.round((runningWos / Math.max(activeWos.length, 1)) * 100)) : 0

    const traffic: 'green' | 'amber' | 'red' =
      qc.openNcr > 2 || delayedOrders > 3 ? 'red' : delayedOrders > 0 || qc.pendingInspections > 5 ? 'amber' : 'green'

    return {
      orderBookValue,
      productionValue,
      dispatchValue,
      purchaseCommitments,
      inventoryValue,
      openNcr: qc.openNcr,
      delayedOrders,
      capacityUtil,
      traffic,
      openOrders: openOrders.length,
      activeWos: activeWos.length,
    }
  }, [salesOrders, workOrders, purchaseOrders, dispatches, inspections, reworks, ncrs, mrpRuns, stockMovements, reservations, items])
}

export function usePurchaseWorkspaceMetrics() {
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)

  return useMemo(() => {
    const pendingPr = usePurchaseStore.getState().getPendingPrReport()
    const openPo = usePurchaseStore.getState().getOpenPoReport()
    const delayed = usePurchaseStore.getState().getDelayedPoReport()
    const expected = usePurchaseStore.getState().getMaterialExpectedThisWeek()

    return {
      pendingPr: pendingPr.filter((p) => ['draft', 'submitted'].includes(p.status)).length,
      pendingApproval: requisitions.filter((p) => p.status === 'submitted').length,
      openPo: openPo.length,
      vendorDelays: delayed.length,
      expectedDeliveries: expected.length,
      recentPr: requisitions.slice(0, 8),
      atRisk: delayed.slice(0, 6),
    }
  }, [requisitions, purchaseOrders])
}

export function useProductionWorkspaceMetrics() {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)
  const mrpRuns = useMrpStore((s) => s.runs)

  return useMemo(() => {
    const qc = useQualityStore.getState().getMetrics()
    const mrp = useMrpStore.getState().getDashboardSummary()

    const running = workOrders.filter((w) => w.status === 'in_production')
    const late = workOrders.filter(
      (w) => !['closed', 'completed', 'cancelled'].includes(w.status) && w.plannedFinishDate && w.plannedFinishDate < new Date().toISOString().slice(0, 10),
    )
    const qcHold = useQualityStore.getState().getOpenReworks().length + useQualityStore.getState().getPendingInspections().length
    const rework = useQualityStore.getState().getOpenReworks()

    return {
      running: running.length,
      late: late.length,
      qcHolds: qcHold,
      reworkJobs: rework.length,
      materialShortages: mrp.materialShortages,
      capacityUtil: running.length > 0 ? Math.round((running.length / Math.max(workOrders.filter((w) => w.status !== 'closed').length, 1)) * 100) : 0,
      runningList: running.slice(0, 8),
      lateList: late.slice(0, 6),
      openRework: qc.openRework,
    }
  }, [workOrders, inspections, reworks, ncrs, mrpRuns])
}

export function useQualityWorkspaceMetrics() {
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const ncrs = useQualityStore((s) => s.ncrs)

  return useMemo(() => useQualityStore.getState().getMetrics(), [inspections, reworks, ncrs])
}

export function useDispatchWorkspaceMetrics() {
  const dispatches = useDispatchStore((s) => s.dispatches)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const stockMovements = useInventoryStore((s) => s.stockMovements)

  return useMemo(() => {
    const metrics = useDispatchStore.getState().getMetrics()
    const ready = useDispatchStore.getState().getReadyCandidates()
    const pending = useDispatchStore.getState().getPendingDispatchReport()
    const today = new Date().toISOString().slice(0, 10)

    return {
      ...metrics,
      readyCount: ready.length,
      loadingToday: dispatches.filter((d) => d.plannedDate === today).length,
      dispatchedToday: dispatches.filter((d) => d.dispatchDate === today).length,
      podPending: dispatches.filter((d) => d.status === 'in_transit').length,
      schedule: pending.slice(0, 8),
    }
  }, [dispatches, workOrders, salesOrders, inspections, stockMovements])
}

export function useSalesWorkspaceMetrics() {
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const inspections = useQualityStore((s) => s.inspections)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const invoices = useInvoiceStore((s) => s.invoices)

  return useMemo(() => {
    const open = salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status))
    const confirmed = open.filter((so) => ['confirmed', 'frozen', 'in_production', 'partially_dispatched'].includes(so.status))
    const salesOrderValue = open.reduce((s, o) => s + (o.grandTotal ?? 0), 0)
    const ordersPendingMrp = open.filter((so) => so.status === 'confirmed' && !workOrders.some((w) => w.salesOrderId === so.id)).length
    const ordersInProduction = open.filter((so) =>
      workOrders.some((w) => w.salesOrderId === so.id && ['released', 'in_progress'].includes(w.status)),
    ).length
    const ordersOnQcHold = open.filter((so) =>
      workOrders.some(
        (w) =>
          w.salesOrderId === so.id &&
          inspections.some((i) => i.workOrderId === w.id && i.status === 'pending'),
      ),
    ).length
    const dispatchReadyOrders = open.filter((so) =>
      dispatches.some((d) => d.salesOrderId === so.id && ['ready', 'planned', 'loading'].includes(d.status)),
    ).length
    const invoicedOrders = salesOrders.filter((so) => invoices.some((i) => i.salesOrderId === so.id)).length
    const closedOrders = salesOrders.filter((so) => so.status === 'closed').length

    return {
      confirmedSalesOrders: confirmed.length,
      openOrders: open.length,
      salesOrderValue,
      ordersPendingMrp,
      ordersInProduction,
      ordersOnQcHold,
      dispatchReadyOrders,
      invoicedOrders,
      closedOrders,
      pipelineValue: salesOrderValue,
    }
  }, [salesOrders, workOrders, inspections, dispatches, invoices])
}

export function useInventoryWorkspaceMetrics() {
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const reservations = useInventoryStore((s) => s.reservations)
  const items = useMasterStore((s) => s.items)

  return useMemo(() => {
    const stock = useInventoryStore.getState().getStockPositions()
    const low = useInventoryStore.getState().getLowStockItems()
    const getItem = useMasterStore.getState().getItem

    const totalValue = stock.reduce((s, p) => s + p.onHand * (getItem(p.itemId)?.standardRate ?? 0), 0)

    return {
      skuCount: stock.filter((p) => p.onHand > 0).length,
      lowStock: low.length,
      activeReservations: reservations.filter((r) => r.status === 'active').length,
      inventoryValue: totalValue,
      lowStockItems: low.slice(0, 8),
    }
  }, [stockMovements, reservations, items])
}

export function formatMetricCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (n >= 100000) return formatCurrency(n)
  return formatCurrency(n)
}
