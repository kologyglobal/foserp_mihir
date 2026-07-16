import type { LiveAlert, LiveActivityEvent, DocumentHealth, NextBestAction } from '../components/live-erp/types'
import type { NotificationItem } from '../store/uiStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useMrpStore } from '../store/mrpStore'
import type { WorkOrder } from '../types/workorder'
import type { SalesOrder } from '../types/mrp'
import type { PurchaseOrder, GrnHeader } from '../types/purchase'
import type { DispatchPlan } from '../types/dispatch'
import type { SalesInvoice } from '../types/invoice'
import type { QcInspection } from '../types/quality'
import type { JobWorkOrderView } from '../types/jobWork'
import { useSalesStore } from '../store/salesStore'
import { CRM_QUOTATIONS_PENDING_APPROVAL_PATH } from './crmQuotationNavigation'
import { salesCustomer360Path, customer360Path } from '../config/entity360Routes'
import { useInvoiceStore } from '../store/invoiceStore'

function woHasQcHold(woId: string): boolean {
  const state = useWorkOrderStore.getState()
  return (
    state.jobCards.some((j) => j.workOrderId === woId && j.status === 'qc_hold') ||
    state.productionOperations.some((o) => o.workOrderId === woId && o.status === 'qc_hold')
  )
}

export function notificationToLiveAlert(n: NotificationItem): LiveAlert {
  const severity =
    n.severity === 'red' ? 'critical' : n.severity === 'amber' ? 'high' : 'medium'
  const category =
    n.type === 'approval'
      ? 'approval'
      : n.type === 'qc'
        ? 'qc_hold'
        : n.type === 'shortage'
          ? 'shortage'
          : n.type === 'delay'
            ? 'delay'
            : n.type === 'wo'
              ? 'general'
              : 'general'
  return {
    id: n.id,
    severity,
    category,
    message: n.title,
    documentRef: n.description,
    href: n.href,
    actionLabel: n.href ? 'Open' : undefined,
  }
}

export function computeWoHealth(wo: WorkOrder): DocumentHealth {
  if (woHasQcHold(wo.id)) return 'blocked'
  if (wo.status === 'cancelled') return 'critical'
  const today = new Date().toISOString().slice(0, 10)
  if (wo.plannedFinishDate && wo.plannedFinishDate < today && !['closed', 'completed', 'fg_received'].includes(wo.status)) {
    return 'at_risk'
  }
  if (['released', 'in_production', 'completed', 'fg_received'].includes(wo.status)) return 'healthy'
  return 'at_risk'
}

export function buildWoNextActions(wo: WorkOrder): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (['released', 'planned'].includes(wo.status)) {
    actions.push({ id: 'reserve', label: 'Reserve Material', href: `/inventory/reservations?wo=${wo.id}`, priority: 'primary' })
  }
  if (['released', 'material_reserved', 'partially_issued', 'fully_issued'].includes(wo.status)) {
    actions.push({ id: 'issue', label: 'Issue Material', href: '/inventory/issue', priority: actions.length === 0 ? 'primary' : undefined })
  }
  if (wo.status === 'in_production') {
    actions.push({ id: 'qc', label: 'Request QC', href: '/quality/queue', priority: 'primary' })
    actions.push({ id: 'fg', label: 'Post FG Receipt', href: '/inventory/fg-receipt' })
  }
  if (woHasQcHold(wo.id)) {
    actions.unshift({ id: 'qc-open', label: 'Open QC Inspection', href: '/quality/queue', priority: 'primary' })
    actions.push({ id: 'rework', label: 'View Rework Orders', href: '/quality/rework' })
  }
  actions.push({ id: '360', label: 'Open WO 360', href: `/work-orders/${wo.id}/360` })
  return actions
}

export function buildProductionLiveAlerts(): LiveAlert[] {
  const wo = useWorkOrderStore.getState()
  const qc = useQualityStore.getState()
  const mrp = useMrpStore.getState()
  const alerts: LiveAlert[] = []

  const qcHoldWoIds = new Set(
    wo.jobCards.filter((j) => j.status === 'qc_hold').map((j) => j.workOrderId),
  )
  for (const w of wo.workOrders.filter((w) => qcHoldWoIds.has(w.id)).slice(0, 2)) {
    alerts.push({
      id: `qc-hold-${w.id}`,
      severity: 'high',
      category: 'qc_hold',
      message: `QC hold on ${w.woNo} — reinspection may be pending`,
      documentRef: w.outputItemCode ?? '',
      href: `/work-orders/${w.id}/360`,
      actionLabel: 'Open QC',
    })
  }

  const shortages = mrp.getDashboardSummary().materialShortages
  if (shortages > 0) {
    alerts.push({
      id: 'mrp-short',
      severity: 'critical',
      category: 'shortage',
      message: `${shortages} material shortage(s) affecting production`,
      href: '/mrp/planner',
      actionLabel: 'Open MRP',
    })
  }

  const pendingQc = qc.getMetrics().pendingInspections
  if (pendingQc > 0) {
    alerts.push({
      id: 'qc-pending',
      severity: 'medium',
      category: 'qc_hold',
      message: `${pendingQc} inspection(s) waiting in QC queue`,
      href: '/quality/queue',
      actionLabel: 'Open Queue',
    })
  }

  return alerts
}

export function buildDispatchLiveAlerts(): LiveAlert[] {
  const dispatches = useDispatchStore.getState().dispatches
  const alerts: LiveAlert[] = []
  const blocked = dispatches.filter((d) => d.status === 'ready' || d.status === 'loading')
  if (blocked.length > 0) {
    alerts.push({
      id: 'dispatch-ready',
      severity: 'medium',
      category: 'dispatch',
      message: `${blocked.length} trailer(s) ready for loading / dispatch`,
      href: '/dispatch/register',
      actionLabel: 'Open Dispatch',
    })
  }
  const podPending = dispatches.filter((d) => ['dispatched', 'in_transit', 'delivered'].includes(d.status))
  if (podPending.length > 0) {
    alerts.push({
      id: 'pod-pending',
      severity: 'high',
      category: 'dispatch',
      message: `${podPending.length} dispatch(es) awaiting POD confirmation`,
      href: '/dispatch/register',
      actionLabel: 'Record POD',
    })
  }
  return alerts
}

export function buildPurchaseLiveAlerts(): LiveAlert[] {
  const purchase = usePurchaseStore.getState()
  const alerts: LiveAlert[] = []
  for (const po of purchase.getDelayedPoReport().slice(0, 3)) {
    alerts.push({
      id: `delay-${po.poId}`,
      severity: 'high',
      category: 'delay',
      message: `Delayed delivery — PO ${po.poNo} from ${po.vendorName}`,
      documentRef: `Expected ${po.expectedDate}`,
      href: `/purchase/orders/${po.poId}`,
      actionLabel: 'Open PO',
    })
  }
  const pendingPr = purchase.getPendingPrReport().filter((p) => p.status === 'submitted')
  if (pendingPr.length > 0) {
    alerts.push({
      id: 'pr-approval',
      severity: 'medium',
      category: 'approval',
      message: `${pendingPr.length} PR(s) waiting for approval`,
      href: '/purchase/requisitions',
      actionLabel: 'Review PRs',
    })
  }
  return alerts
}

export function activityFromNotifications(notifications: NotificationItem[]): LiveActivityEvent[] {
  return notifications.slice(0, 6).map((n) => ({
    id: `act-${n.id}`,
    icon: n.type === 'qc' ? 'qc' : n.type === 'approval' ? 'approval' : n.type === 'shortage' ? 'material' : 'general',
    action: n.title,
    user: 'System',
    timestamp: n.createdAt,
    href: n.href,
    documentRef: n.description,
  }))
}

// ─── Sales Order ─────────────────────────────────────────────────────────────

export function computeSoHealth(so: SalesOrder): DocumentHealth {
  const today = new Date().toISOString().slice(0, 10)
  if (so.status === 'closed' || so.status === 'invoiced') return 'healthy'
  if (so.requiredDate < today && !['dispatched', 'closed', 'invoiced'].includes(so.status)) return 'at_risk'
  if (so.status === 'open') return 'at_risk'
  return 'healthy'
}

export function buildSoNextActions(so: SalesOrder): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (so.status === 'open') {
    actions.push({ id: 'confirm', label: 'Confirm Order', href: `/sales/orders/${so.id}`, priority: 'primary' })
  }
  if (so.status === 'confirmed') {
    actions.push({ id: 'mrp', label: 'Run MRP', href: '/mrp/run', priority: 'primary' })
    actions.push({ id: 'wo', label: 'Create Work Order', href: '/work-orders' })
  }
  if (['confirmed', 'in_production', 'ready_dispatch'].includes(so.status)) {
    actions.push({ id: 'material', label: 'Check Material Readiness', href: '/mrp/planner' })
    actions.push({ id: 'dispatch', label: 'Plan Dispatch', href: '/dispatch/plan' })
  }
  actions.push({ id: 'customer', label: 'Company 360', href: salesCustomer360Path(so.customerId) })
  return actions
}

export function buildSoDocumentAlerts(so: SalesOrder): LiveAlert[] {
  const alerts: LiveAlert[] = []
  const today = new Date().toISOString().slice(0, 10)
  if (so.requiredDate < today && !['dispatched', 'closed', 'invoiced'].includes(so.status)) {
    alerts.push({
      id: `so-late-${so.id}`,
      severity: 'high',
      category: 'delay',
      message: `Required date ${so.requiredDate} passed — order still ${so.status.replace('_', ' ')}`,
      documentRef: so.salesOrderNo,
      href: `/sales/orders/${so.id}`,
      actionLabel: 'Review SO',
    })
  }
  if (so.status === 'confirmed') {
    alerts.push({
      id: `so-mrp-${so.id}`,
      severity: 'medium',
      category: 'general',
      message: 'Order confirmed — MRP / production planning may be required',
      href: '/mrp/run',
      actionLabel: 'Run MRP',
    })
  }
  return alerts
}

// ─── Purchase Order ──────────────────────────────────────────────────────────

export function computePoHealth(po: PurchaseOrder): DocumentHealth {
  const today = new Date().toISOString().slice(0, 10)
  if (po.status === 'cancelled') return 'critical'
  if (po.status === 'submitted') return 'blocked'
  if (po.expectedDate < today && !['received', 'closed'].includes(po.status)) return 'at_risk'
  return 'healthy'
}

export function buildPoNextActions(po: PurchaseOrder): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (po.status === 'draft') {
    actions.push({ id: 'submit', label: 'Submit for PO Approval', href: `/purchase/orders/${po.id}`, priority: 'primary' })
  }
  if (po.status === 'submitted') {
    actions.push({ id: 'approve', label: 'Approve and Release PO', href: `/purchase/orders/${po.id}`, priority: 'primary' })
  }
  if (po.status === 'approved') {
    actions.push({ id: 'release', label: 'Release Purchase Order', href: `/purchase/orders/${po.id}`, priority: 'primary' })
    actions.push({ id: 'send', label: 'Send to Vendor', href: `/purchase/orders/${po.id}` })
  }
  if (po.status === 'released') {
    actions.push({ id: 'send', label: 'Send / Await Vendor Confirmation', href: `/purchase/orders/${po.id}`, priority: 'primary' })
  }
  if (['sent', 'partial'].includes(po.status)) {
    actions.push({ id: 'grn', label: 'Record Gate Entry and GRN', href: '/purchase/grn', priority: 'primary' })
    actions.push({ id: 'grn-reg', label: 'GRN Register', href: '/purchase/grn' })
  }
  if (po.status === 'received') {
    actions.push({ id: 'close', label: 'Close Purchase Order', href: `/purchase/orders/${po.id}`, priority: 'primary' })
  }
  actions.push({ id: 'vendor', label: 'Vendor 360', href: `/masters/vendors/${po.vendorId}/360` })
  return actions
}

export function buildPoDocumentAlerts(po: PurchaseOrder, vendorName?: string): LiveAlert[] {
  const alerts: LiveAlert[] = []
  const today = new Date().toISOString().slice(0, 10)
  if (po.status === 'submitted') {
    alerts.push({
      id: `po-appr-${po.id}`,
      severity: 'medium',
      category: 'approval',
      message: `PO ${po.poNo} waiting for Purchase Head approval`,
      documentRef: vendorName,
      href: `/purchase/orders/${po.id}`,
      actionLabel: 'Review PO',
    })
  }
  if (po.expectedDate < today && !['received', 'closed', 'cancelled'].includes(po.status)) {
    alerts.push({
      id: `po-delay-${po.id}`,
      severity: 'high',
      category: 'delay',
      message: `Delayed delivery — expected ${po.expectedDate}`,
      documentRef: vendorName,
      href: `/purchase/orders/${po.id}`,
      actionLabel: 'Open PO',
    })
  }
  return alerts
}

// ─── GRN ─────────────────────────────────────────────────────────────────────

export function buildGrnNextActions(grn: GrnHeader): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (grn.status === 'pending_qc') {
    actions.push({ id: 'qc', label: 'Complete Quality Inspection', href: '/quality/incoming', priority: 'primary' })
  }
  if (grn.status === 'draft') {
    actions.push({ id: 'post', label: 'Complete Gate Entry and Post GRN', href: `/purchase/grn/${grn.id}`, priority: 'primary' })
  }
  if (grn.status === 'posted') {
    actions.push({ id: 'stock', label: 'Accepted Stock Posted (demo)', href: `/purchase/grn/${grn.id}` })
  }
  actions.push({ id: 'po', label: 'View Source PO', href: `/purchase/orders/${grn.poId}` })
  return actions
}

export function buildGrnDocumentAlerts(grn: GrnHeader): LiveAlert[] {
  if (grn.status !== 'pending_qc') return []
  return [{
    id: `grn-qc-${grn.id}`,
    severity: 'high',
    category: 'qc_hold',
    message: `Incoming QC required before stock posting — ${grn.grnNo}`,
    href: '/quality/incoming',
    actionLabel: 'Open QC',
  }]
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

export function computeDispatchHealth(plan: DispatchPlan): DocumentHealth {
  if (plan.status === 'cancelled') return 'critical'
  const checklistIncomplete = plan.checklist.some((c) => c.mandatory && !c.passed)
  if (['planned', 'loading'].includes(plan.status) && checklistIncomplete) return 'blocked'
  if (['dispatched', 'in_transit', 'delivered'].includes(plan.status) && !plan.customerAck) return 'at_risk'
  if (plan.status === 'closed') return 'healthy'
  return 'healthy'
}

export function buildDispatchNextActions(plan: DispatchPlan): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (['ready', 'planned', 'loading'].includes(plan.status)) {
    actions.push({ id: 'qc', label: 'Verify Final QC', href: '/quality/queue', priority: 'primary' })
    actions.push({ id: 'scan', label: 'Scan Trailer QR', href: `/scan?mode=Dispatch&dispatchId=${plan.id}` })
    actions.push({ id: 'gate', label: 'Print Gate Pass', href: `/dispatch/${plan.id}/gate-pass` })
  }
  if (['planned', 'loading'].includes(plan.status)) {
    actions.push({ id: 'confirm', label: 'Confirm Dispatch', href: `/dispatch/${plan.id}` })
  }
  if (['dispatched', 'in_transit', 'delivered'].includes(plan.status)) {
    actions.push({ id: 'pod', label: 'Record POD', href: `/dispatch/${plan.id}`, priority: 'primary' })
  }
  return actions
}

export function buildDispatchDocumentAlerts(plan: DispatchPlan): LiveAlert[] {
  const alerts: LiveAlert[] = []
  const missingChecklist = plan.checklist.filter((c) => c.mandatory && !c.passed)
  if (missingChecklist.length > 0 && ['planned', 'loading'].includes(plan.status)) {
    alerts.push({
      id: `disp-doc-${plan.id}`,
      severity: 'high',
      category: 'document',
      message: `${missingChecklist.length} mandatory checklist item(s) incomplete`,
      documentRef: plan.dispatchNo,
      href: `/dispatch/${plan.id}`,
      actionLabel: 'Complete Checklist',
    })
  }
  if (['dispatched', 'in_transit', 'delivered'].includes(plan.status) && !plan.customerAck) {
    alerts.push({
      id: `disp-pod-${plan.id}`,
      severity: 'medium',
      category: 'dispatch',
      message: `POD pending for ${plan.customerName}`,
      documentRef: plan.dispatchNo,
      href: `/dispatch/${plan.id}`,
      actionLabel: 'Record POD',
    })
  }
  return alerts
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export function computeInvoiceHealth(inv: SalesInvoice): DocumentHealth {
  if (inv.paymentStatus === 'overdue') return 'critical'
  if (inv.paymentStatus === 'partial') return 'at_risk'
  if (inv.status === 'draft') return 'at_risk'
  return 'healthy'
}

export function buildInvoiceNextActions(inv: SalesInvoice): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (inv.status === 'draft') {
    actions.push({ id: 'post', label: 'Post Invoice', href: `/invoices/${inv.id}`, priority: 'primary' })
  }
  if (inv.paymentStatus !== 'paid') {
    actions.push({ id: 'payment', label: 'Record Payment', href: `/invoices/${inv.id}`, priority: 'primary' })
  }
  if (inv.dispatchId) actions.push({ id: 'dispatch', label: 'Open Dispatch', href: `/dispatch/${inv.dispatchId}` })
  actions.push({ id: 'customer', label: 'Company 360', href: customer360Path(inv.customerId) })
  return actions
}

// ─── QC Inspection ───────────────────────────────────────────────────────────

export function buildQcNextActions(inspection: QcInspection): NextBestAction[] {
  if (inspection.status !== 'pending') {
    return [{ id: 'queue', label: 'Back to QC Queue', href: '/quality/queue' }]
  }
  const actions: NextBestAction[] = [
    { id: 'complete', label: 'Complete Inspection', href: `/quality/inspections/${inspection.id}`, priority: 'primary' },
    { id: 'rework', label: 'Raise Rework', href: `/quality/inspections/${inspection.id}` },
    { id: 'ncr', label: 'Raise NCR', href: '/quality/ncr' },
  ]
  if (inspection.workOrderId) {
    actions.push({ id: 'release', label: 'Release Operation', href: `/work-orders/${inspection.workOrderId}/360` })
  }
  return actions
}

// ─── Job Work ────────────────────────────────────────────────────────────────

export function buildJobWorkNextActions(jwo: JobWorkOrderView): NextBestAction[] {
  const actions: NextBestAction[] = []
  if (jwo.status === 'draft') actions.push({ id: 'approve', label: 'Approve Job Work', href: `/job-work/${jwo.workOrderId}`, priority: 'primary' })
  if (!['closed', 'received'].includes(jwo.status)) {
    actions.push({ id: 'send', label: 'Send Material', href: `/job-work/${jwo.workOrderId}`, priority: 'primary' })
    actions.push({ id: 'receive', label: 'Receive Material', href: `/job-work/${jwo.workOrderId}` })
  }
  if (jwo.qcStatus === 'pending' || jwo.status === 'qc_pending') {
    actions.push({ id: 'qc', label: 'Complete QC', href: '/quality/queue', priority: 'primary' })
  }
  actions.push({ id: 'wo', label: 'Open WO 360', href: `/work-orders/${jwo.workOrderId}/360` })
  return actions
}

// ─── Workspace alert builders ────────────────────────────────────────────────

export function buildSalesLiveAlerts(input?: {
  atRiskOrders?: { severity: string; salesOrderNo: string; id: string }[]
  ordersPendingMrp?: number
}): LiveAlert[] {
  const sales = useSalesStore.getState()
  const alerts: LiveAlert[] = []

  const criticalRisk = input?.atRiskOrders?.filter((o) => o.severity === 'critical') ?? []
  for (const order of criticalRisk.slice(0, 2)) {
    alerts.push({
      id: `so-overdue-${order.id}`,
      severity: 'critical',
      category: 'delay',
      message: `${order.salesOrderNo} — past delivery commitment`,
      href: `/sales/orders/${order.id}`,
      actionLabel: 'Open SO',
    })
  }

  const pendingMrp = input?.ordersPendingMrp ?? 0
  if (pendingMrp > 0) {
    alerts.push({
      id: 'so-mrp-pending',
      severity: pendingMrp > 2 ? 'high' : 'medium',
      category: 'general',
      message: `${pendingMrp} confirmed order(s) need MRP / work order`,
      href: '/mrp/run',
      actionLabel: 'Run MRP',
    })
  }

  const pendingApprovals = sales.quotations.filter((q) => q.status === 'submitted').length
  if (pendingApprovals > 0) {
    alerts.push({
      id: 'quote-approval',
      severity: 'medium',
      category: 'approval',
      message: `${pendingApprovals} quotation(s) awaiting approval`,
      href: CRM_QUOTATIONS_PENDING_APPROVAL_PATH,
      actionLabel: 'Review Approvals',
    })
  }

  const highRisk = input?.atRiskOrders?.filter((o) => o.severity === 'high') ?? []
  if (highRisk.length > 0 && alerts.length < 4) {
    alerts.push({
      id: `so-risk-${highRisk[0].id}`,
      severity: 'high',
      category: 'delay',
      message: `${highRisk.length} order(s) at delivery or QC risk`,
      href: '/sales/order-status',
      actionLabel: 'View Status',
    })
  }

  return alerts
}

export function buildQualityLiveAlerts(): LiveAlert[] {
  const qc = useQualityStore.getState()
  const alerts: LiveAlert[] = []
  const pending = qc.getMetrics().pendingInspections
  if (pending > 0) {
    alerts.push({
      id: 'qc-queue',
      severity: 'high',
      category: 'qc_hold',
      message: `${pending} inspection(s) waiting in QC queue`,
      href: '/quality/queue',
      actionLabel: 'Open Queue',
    })
  }
  const ageingNcr = qc.ncrs.filter((n) => n.status === 'open').length
  if (ageingNcr > 0) {
    alerts.push({
      id: 'ncr-open',
      severity: 'medium',
      category: 'qc_hold',
      message: `${ageingNcr} open NCR(s) require disposition`,
      href: '/quality/ncr',
      actionLabel: 'Open NCR',
    })
  }
  return alerts
}

export function buildFinanceLiveAlerts(): LiveAlert[] {
  const inv = useInvoiceStore.getState()
  const alerts: LiveAlert[] = []
  const overdue = inv.invoices.filter((i) => i.paymentStatus === 'overdue').length
  if (overdue > 0) {
    alerts.push({
      id: 'inv-overdue',
      severity: 'critical',
      category: 'payment',
      message: `${overdue} overdue invoice(s) — collection action required`,
      href: '/invoices/register',
      actionLabel: 'Open Invoices',
    })
  }
  const unpaid = inv.invoices.filter((i) => i.paymentStatus === 'unpaid' && i.status === 'posted').length
  if (unpaid > 0) {
    alerts.push({
      id: 'inv-unpaid',
      severity: 'medium',
      category: 'payment',
      message: `${unpaid} posted invoice(s) awaiting payment`,
      href: '/invoices/register',
      actionLabel: 'Record Payment',
    })
  }
  return alerts
}
