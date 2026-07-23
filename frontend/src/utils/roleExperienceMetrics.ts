import { useMemo } from 'react'
import type { ExperienceRole, RoleKpi, RoleKpiAccent } from '../types/roleExperience'
import type { InboxItem } from './controlTowerMetrics'
import {
  getExecutiveDashboardData,
  getMrpPlannerWorkbenchData,
  getProductionControlTowerData,
  getUnifiedInboxData,
} from './controlTowerMetrics'
import { getRoleExperienceDefinition } from '../config/roleExperience'
import { formatMetricCurrency } from './workspaceMetrics'
import { useMasterStore } from '../store/masterStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useBomStore } from '../store/bomStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useApprovalStore } from '../store/approvalStore'

const CONTROL_TOWER_PATHS = {
  production: '/manufacturing/control-room',
  mrpPlanner: '/manufacturing/production-plan',
}

function kpi(id: string, label: string, value: string | number, accent: RoleKpiAccent, href?: string): RoleKpi {
  return { id, label, value, accent, href }
}

/** Compute all KPI values once — keyed by id for role config pickers */
export function computeAllRoleKpis(): Record<string, RoleKpi> {
  const exec = getExecutiveDashboardData()
  const prod = getProductionControlTowerData()
  const mrp = getMrpPlannerWorkbenchData()
  const purchaseOrders = usePurchaseStore.getState().purchaseOrders
  const grns = usePurchaseStore.getState().grns
  const bomHeaders = useBomStore.getState().bomHeaders
  const products = useMasterStore.getState().products
  const qc = useQualityStore.getState().getMetrics()
  const dispatches = useDispatchStore.getState().dispatches
  const invMetrics = useInvoiceStore.getState().getMetrics()
  const reservations = useInventoryStore.getState().reservations
  const stock = useInventoryStore.getState().getStockPositions()
  const pendingPr = usePurchaseStore.getState().getPendingPrReport().filter((p) => p.status === 'submitted').length
  const delayedPo = usePurchaseStore.getState().getDelayedPoReport().length
  const costOverridePending = products.filter((p) => p.standardCost.costOverride && !p.standardCost.overrideApprovedBy).length
  const submittedBom = bomHeaders.filter((b) => b.status === 'submitted').length
  const releasedProducts = products.filter((p) => p.status === 'released').length
  const readyToDispatch = dispatches.filter((d) => d.status === 'ready').length
  const dispatchPending = dispatches.filter((d) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status)).length
  const podPending = dispatches.filter((d) => ['dispatched', 'in_transit', 'delivered'].includes(d.status)).length
  const negativeStock = stock.filter((s) => s.onHand < 0).length
  const openReservations = reservations.filter((r) => r.status === 'active').length
  const incomingQc = useQualityStore.getState().inspections.filter((i) => i.category === 'incoming' && i.status === 'pending').length
  const overdueInvoices = useInvoiceStore.getState().invoices.filter((i) => i.paymentStatus === 'overdue').length
  const dispatchUnbilled = dispatches.filter((d) => ['dispatched', 'in_transit', 'delivered', 'pod_received'].includes(d.status) && !d.invoiceId).length
  const openRfq = usePurchaseStore.getState().rfqs.filter((r) => !['closed', 'cancelled'].includes(r.status)).length

  return {
    orderBook: kpi('orderBook', 'Order Book', formatMetricCurrency(exec.orderBookValue), 'blue', '/sales/orders'),
    productionValue: kpi('productionValue', 'Production Value', formatMetricCurrency(exec.productionValue), 'blue', CONTROL_TOWER_PATHS.production),
    wipValue: kpi('wipValue', 'WIP Value', formatMetricCurrency(exec.wipValue), 'blue', '/manufacturing/work-orders'),
    fgValue: kpi('fgValue', 'FG Value', formatMetricCurrency(exec.fgValue), 'green', '/inventory/ledger'),
    dispatchValue: kpi('dispatchValue', 'Dispatch Value', formatMetricCurrency(exec.dispatchValue), 'blue', '/dispatch/register'),
    invoiceValue: kpi('invoiceValue', 'Invoiced YTD', formatMetricCurrency(exec.invoiceValue), 'blue', '/accounting/money-in/invoices'),
    outstanding: kpi('outstanding', 'Outstanding AR', formatMetricCurrency(exec.outstanding), exec.outstanding > 0 ? 'amber' : 'green', '/accounting/money-in/outstanding'),
    paymentReceived: kpi('paymentReceived', 'Collected', formatMetricCurrency(exec.paymentReceived), 'green'),
    delayedOrders: kpi('delayedOrders', 'Delayed Orders', exec.delayedOrders, exec.delayedOrders ? 'red' : 'green', '/sales/orders'),
    openNcr: kpi('openNcr', 'Open NCR', exec.openNcr, exec.openNcr ? 'red' : 'green', '/quality/ncr'),
    capacityUtil: kpi('capacityUtil', 'Capacity Util', `${exec.capacityUtil}%`, 'blue', CONTROL_TOWER_PATHS.production),
    costVariance: kpi('costVariance', 'Cost Variance', formatMetricCurrency(exec.costVariance), 'amber', '/accounting/manufacturing'),
    activeWo: kpi('activeWo', 'Active WO', prod.running + prod.late + prod.qcHolds, 'blue', '/manufacturing/work-orders'),
    lateWo: kpi('lateWo', 'Late WO', prod.late, prod.late ? 'red' : 'green', '/manufacturing/work-orders'),
    qcPending: kpi('qcPending', 'QC Pending', prod.qcHolds, prod.qcHolds ? 'amber' : 'green', '/quality/queue'),
    materialShortages: kpi('materialShortages', 'MRP Shortages', prod.materialShortages, prod.materialShortages ? 'red' : 'green', CONTROL_TOWER_PATHS.mrpPlanner),
    dispatchPending: kpi('dispatchPending', 'Open Dispatch', dispatchPending, dispatchPending ? 'amber' : 'green', '/dispatch/register'),
    pendingPr: kpi('pendingPr', 'PR Pending Approval', pendingPr, pendingPr ? 'amber' : 'green', '/purchase/requisitions'),
    poApprovalPending: kpi('poApprovalPending', 'PO Pending Approval', purchaseOrders.filter((p) => p.status === 'submitted').length, 'amber', '/purchase/orders'),
    openPo: kpi('openPo', 'Open PO', purchaseOrders.filter((p) => !['closed', 'cancelled'].includes(p.status)).length, 'blue', '/purchase/orders'),
    delayedPo: kpi('delayedPo', 'Delayed PO', delayedPo, delayedPo ? 'red' : 'green', '/purchase/orders'),
    grnPending: kpi('grnPending', 'Draft GRN', grns.filter((g) => g.status === 'draft').length, 'blue', '/purchase/grn'),
    vendorQuotes: kpi('vendorQuotes', 'Open RFQ', openRfq, 'blue', '/purchase/rfqs'),
    openSo: kpi('openSo', 'Open Sales Orders', mrp.openSo.length, 'blue', '/sales/orders'),
    mrpShortages: kpi('mrpShortages', 'Material Shortages', mrp.shortages.length, mrp.shortages.length ? 'red' : 'green', CONTROL_TOWER_PATHS.mrpPlanner),
    expediteCount: kpi('expediteCount', 'Expedite Lines', mrp.expediteCount, mrp.expediteCount ? 'amber' : 'green', '/purchase/requisitions'),
    woMaterialShort: kpi('woMaterialShort', 'WO Material Gaps', mrp.woShortages.length, mrp.woShortages.length ? 'red' : 'green', '/manufacturing/work-orders'),
    submittedBom: kpi('submittedBom', 'BOM Awaiting Approval', submittedBom, submittedBom ? 'amber' : 'green', '/manufacturing/setup/boms'),
    releasedProducts: kpi('releasedProducts', 'Released Products', releasedProducts, 'green', '/masters/products'),
    openEco: kpi('openEco', 'Products in Review', products.filter((p) => p.status === 'engineering_review').length, 'amber', '/masters/products'),
    pendingDrawings: kpi('pendingDrawings', 'Draft BOM', bomHeaders.filter((b) => b.status === 'draft').length, 'blue', '/manufacturing/setup/boms'),
    routingDraft: kpi('routingDraft', 'Eng Review Products', products.filter((p) => p.status === 'engineering_review').length, 'amber', '/masters/routing'),
    costOverridePending: kpi('costOverridePending', 'Cost Override Pending', costOverridePending, costOverridePending ? 'amber' : 'green', '/masters/products'),
    openReservations: kpi('openReservations', 'Active Reservations', openReservations, 'blue', '/inventory/reservations'),
    negativeStock: kpi('negativeStock', 'Negative Stock Items', negativeStock, negativeStock ? 'red' : 'green', '/inventory/reports'),
    pendingIssues: kpi('pendingIssues', 'WO Lines to Issue', useWorkOrderStore.getState().materialLines.filter((l) => l.balanceQty > 0).length, 'amber', '/inventory/issue'),
    slowMoving: kpi('slowMoving', 'Low Stock SKUs', stock.filter((s) => s.isLowStock).length, 'amber', '/inventory/reports'),
    qcIncoming: kpi('qcIncoming', 'Incoming QC Queue', incomingQc, incomingQc ? 'amber' : 'green', '/quality/incoming'),
    runningWo: kpi('runningWo', 'WO In Production', prod.running, 'green', '/manufacturing/work-orders'),
    todayJobCards: kpi('todayJobCards', 'Active Job Cards', prod.todayJobCards.length, 'blue', '/manufacturing/work-orders'),
    qcHolds: kpi('qcHolds', 'QC Holds', prod.qcHolds, prod.qcHolds ? 'red' : 'green', '/quality/queue'),
    openRework: kpi('openRework', 'Open Rework', prod.reworkQueue, prod.reworkQueue ? 'amber' : 'green', '/quality/rework'),
    incomingQc: kpi('incomingQc', 'Incoming Inspections', incomingQc, 'amber', '/quality/incoming'),
    finalQcHold: kpi('finalQcHold', 'Final QC Pending', useQualityStore.getState().inspections.filter((i) => i.category === 'final' && i.status === 'pending').length, 'amber', '/quality/queue'),
    vendorNcr: kpi('vendorNcr', 'Open NCR', qc.openNcr, qc.openNcr ? 'red' : 'green', '/quality/ncr'),
    readyToDispatch: kpi('readyToDispatch', 'Ready to Dispatch', readyToDispatch, 'green', '/dispatch/register'),
    loadingToday: kpi('loadingToday', 'Loading / Planned', dispatches.filter((d) => ['planned', 'loading'].includes(d.status)).length, 'blue', '/dispatch/register'),
    podPending: kpi('podPending', 'Awaiting POD', podPending, podPending ? 'amber' : 'green', '/dispatch/register'),
    inTransit: kpi('inTransit', 'In Transit', dispatches.filter((d) => d.status === 'in_transit').length, 'blue', '/dispatch/register'),
    gatePassPending: kpi('gatePassPending', 'Gate Pass Pending', dispatches.filter((d) => ['planned', 'loading'].includes(d.status) && !d.gatePass?.securityApprovedBy).length, 'amber', '/dispatch/register'),
    paymentPending: kpi('paymentPending', 'Unpaid Invoices', invMetrics.unpaidCount, 'amber', '/accounting/money-in/invoices'),
    overdueInvoices: kpi('overdueInvoices', 'Overdue Invoices', overdueInvoices, overdueInvoices ? 'red' : 'green', '/accounting/money-in/invoices'),
    dispatchUnbilled: kpi('dispatchUnbilled', 'Dispatched — Not Invoiced', dispatchUnbilled, dispatchUnbilled ? 'amber' : 'green', '/accounting/money-in/invoices'),
  }
}

function matchesModules(item: InboxItem, modules: string[]): boolean {
  if (modules.length === 0) return true
  const mod = item.module.toLowerCase()
  return modules.some((m) => mod.includes(m.toLowerCase()))
}

export function filterInboxForRole(items: InboxItem[], modules: string[]): InboxItem[] {
  if (modules.length === 0) return items
  return items.filter((i) => matchesModules(i, modules))
}

export function getRoleExperienceData(role: ExperienceRole) {
  const def = getRoleExperienceDefinition(role)
  const allKpis = computeAllRoleKpis()
  const kpis = def.kpiIds.map((id) => allKpis[id]).filter(Boolean) as RoleKpi[]

  const inbox = getUnifiedInboxData()
  const roleInbox = filterInboxForRole([...inbox.work, ...inbox.tasks, ...inbox.alerts], def.inboxModules).slice(0, 12)
  const roleApprovals = filterInboxForRole(inbox.approvals, def.approvalModules)

  return {
    definition: def,
    kpis,
    inbox: roleInbox,
    approvals: roleApprovals,
    counts: {
      inbox: roleInbox.length,
      approvals: roleApprovals.length,
      matrixRules: useApprovalStore.getState().rules.filter((r) => r.active).length,
    },
  }
}

export function useRoleExperienceData(role: ExperienceRole) {
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const inspections = useQualityStore((s) => s.inspections)
  const invoices = useInvoiceStore((s) => s.invoices)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const products = useMasterStore((s) => s.products)
  const reservations = useInventoryStore((s) => s.reservations)
  const requests = useApprovalStore((s) => s.requests)

  return useMemo(
    () => getRoleExperienceData(role),
    [role, requisitions, workOrders, purchaseOrders, dispatches, inspections, invoices, salesOrders, bomHeaders, products, reservations, requests],
  )
}
