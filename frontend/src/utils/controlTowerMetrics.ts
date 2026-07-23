import { useMemo } from 'react'
import { usePurchaseStore } from '../store/purchaseStore'
import { useSalesStore } from '../store/salesStore'
import { useMrpStore } from '../store/mrpStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useMasterStore } from '../store/masterStore'
import { useInvoiceStore } from '../store/invoiceStore'
import { useCostingStore } from '../store/costingStore'
import type { JobCard, WorkOrder, WorkOrderProductionOperation } from '../types/workorder'
import type { MrpMaterialLine } from '../types/mrp'
import type { NotificationItem } from '../store/uiStore'
import { buildNotifications } from './workspaceMetrics'
import { wo360Path } from '../config/controlTowerRoutes'
import { getSessionUser } from './permissions'
import { listPendingApprovalsForUser } from './approvalEngine'
import { APPROVAL_DOCUMENT_LABELS } from '../types/approvalMatrix'
import { useApprovalStore } from '../store/approvalStore'
import { useCrmStore } from '../store/crmStore'
import { formatCrmCurrency } from './crmMetrics'

const today = () => new Date().toISOString().slice(0, 10)

function isLateWo(w: WorkOrder) {
  return (
    !['closed', 'completed', 'cancelled', 'fg_received'].includes(w.status) &&
    !!w.plannedFinishDate &&
    w.plannedFinishDate < today()
  )
}

export function getProductionControlTowerData() {
  const workOrders = useWorkOrderStore.getState().workOrders
  const jobCards = useWorkOrderStore.getState().jobCards
  const productionOperations = useWorkOrderStore.getState().productionOperations
  const materialLines = useWorkOrderStore.getState().materialLines
  const mrp = useMrpStore.getState().getDashboardSummary()
  const latestRun = useMrpStore.getState().getLatestRun()
  const shortageLines = latestRun?.materialLines.filter((m) => m.shortageQty > 0) ?? []

  const running = workOrders.filter((w) => w.status === 'in_production')
  const late = workOrders.filter(isLateWo)
  const qcHoldCards = jobCards.filter((j) => j.status === 'qc_hold')
  const pendingQc = useQualityStore.getState().getPendingInspections()
  const openRework = useQualityStore.getState().getOpenReworks()

  const woIdsWithShortage = new Set(
    materialLines
      .filter((l) => {
        const wo = workOrders.find((w) => w.id === l.workOrderId)
        return wo && !['closed', 'cancelled', 'completed'].includes(wo.status) && l.balanceQty > 0 && l.issuedQty < l.requiredQty
      })
      .map((l) => l.workOrderId),
  )
  const shortageWos = workOrders.filter((w) => woIdsWithShortage.has(w.id))

  const activeCount = workOrders.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status)).length
  const capacityUtil = activeCount > 0 ? Math.min(100, Math.round((running.length / activeCount) * 100)) : 0

  const todayJobCards = jobCards.filter(
    (j) => ['in_progress', 'assigned'].includes(j.status) || (j.startTime?.startsWith(today()) ?? false),
  )

  const wipByWorkCenterMap = new Map<string, { workCenterCode: string; activeJobs: number; inProgress: number }>()
  for (const jc of jobCards.filter((j) => j.status !== 'completed')) {
    const row = wipByWorkCenterMap.get(jc.workCenterCode) ?? { workCenterCode: jc.workCenterCode, activeJobs: 0, inProgress: 0 }
    row.activeJobs += 1
    if (jc.status === 'in_progress') row.inProgress += 1
    wipByWorkCenterMap.set(jc.workCenterCode, row)
  }
  const wipByWorkCenter = [...wipByWorkCenterMap.values()].sort((a, b) => b.activeJobs - a.activeJobs)

  const activeWoIds = new Set(workOrders.filter((w) => w.status === 'in_production').map((w) => w.id))
  const blockedOperations = productionOperations.filter(
    (op) => activeWoIds.has(op.workOrderId) && (op.status === 'qc_hold' || op.status === 'pending'),
  )

  const traffic: 'green' | 'amber' | 'red' =
    late.length > 0 || mrp.materialShortages > 0 ? 'red' : running.length > 0 ? 'green' : 'amber'

  return {
    traffic,
    running: running.length,
    late: late.length,
    qcHolds: qcHoldCards.length + pendingQc.length,
    materialShortages: mrp.materialShortages,
    capacityUtil,
    reworkQueue: openRework.length,
    runningList: running,
    lateList: late,
    qcHoldList: pendingQc,
    qcHoldJobCards: qcHoldCards,
    shortageLines,
    shortageWos,
    reworkList: openRework,
    todayJobCards,
    wipByWorkCenter,
    blockedOperations,
  }
}

export function useProductionControlTower() {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const inspections = useQualityStore((s) => s.inspections)
  const reworks = useQualityStore((s) => s.reworks)
  const mrpRuns = useMrpStore((s) => s.runs)
  const materialLines = useWorkOrderStore((s) => s.materialLines)

  return useMemo(
    () => getProductionControlTowerData(),
    [workOrders, jobCards, productionOperations, inspections, reworks, mrpRuns, materialLines],
  )
}

export function getMrpPlannerWorkbenchData() {
  const runs = useMrpStore.getState().runs
  const salesOrders = useMrpStore.getState().salesOrders
  const latestRun = runs[0]
  const allLines = latestRun?.materialLines ?? []
  const shortages = allLines.filter((m) => m.shortageQty > 0)
  const delayed = allLines.filter((m) => m.riskStatus === 'delayed')
  const critical = allLines.filter((m) => m.riskStatus === 'critical')
  const delayedPo = usePurchaseStore.getState().getDelayedPoReport()
  const purchaseRequired = allLines.filter((m) => m.suggestedPrQty > 0 || m.suggestedPoQty > 0)

  const atRisk: MrpMaterialLine[] = [...critical, ...delayed.filter((d) => !critical.some((c) => c.id === d.id))].sort(
    (a, b) => a.requiredDate.localeCompare(b.requiredDate),
  )

  const openSo = salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status))

  const soReadiness = openSo.map((so) => {
    const lines = allLines.filter((m) => m.salesOrderId === so.id)
    const shortageCount = lines.filter((m) => m.shortageQty > 0).length
    return { salesOrderId: so.id, salesOrderNo: so.salesOrderNo, requiredDate: so.requiredDate, lineCount: lines.length, shortageCount, ready: shortageCount === 0 && lines.length > 0 }
  })

  const workOrders = useWorkOrderStore.getState().workOrders
  const woMaterialLines = useWorkOrderStore.getState().materialLines
  const woShortages = workOrders
    .filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status))
    .map((w) => ({ wo: w, shortageLines: woMaterialLines.filter((l) => l.workOrderId === w.id && l.balanceQty > 0).length }))
    .filter((x) => x.shortageLines > 0)

  const demandQty = allLines.reduce((s, m) => s + m.requiredQty, 0)
  const supplyQty = allLines.reduce((s, m) => s + m.freeStock + m.suggestedPoQty, 0)

  return {
    latestRun,
    shortages,
    delayedMaterials: delayed,
    atRisk,
    delayedPo,
    openSo,
    expediteCount: purchaseRequired.length,
    purchaseRequired,
    rescheduleSuggestions: atRisk.slice(0, 12),
    soReadiness,
    woShortages,
    demandQty,
    supplyQty,
  }
}

export function useMrpPlannerWorkbench() {
  const runs = useMrpStore((s) => s.runs)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const materialLines = useWorkOrderStore((s) => s.materialLines)

  return useMemo(
    () => getMrpPlannerWorkbenchData(),
    [runs, salesOrders, purchaseOrders, workOrders, materialLines],
  )
}

export function getExecutiveDashboardData() {
  const salesOrders = useMrpStore.getState().salesOrders
  const workOrders = useWorkOrderStore.getState().workOrders
  const dispatches = useDispatchStore.getState().dispatches
  const getItem = useMasterStore.getState().getItem
  const getProduct = useMasterStore.getState().getProduct

  const qc = useQualityStore.getState().getMetrics()
  const mrp = useMrpStore.getState().getDashboardSummary()
  const invMetrics = useInvoiceStore.getState().getMetrics()
  const stock = useInventoryStore.getState().getStockPositions()

  const openOrders = salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status))
  const orderBookValue = openOrders.reduce((s, o) => {
    const product = getProduct(o.productId)
    const lineTotal = o.grandTotal ?? (o.unitPrice ?? product?.standardPrice ?? 0) * o.qty
    return s + lineTotal
  }, 0)

  const activeWos = workOrders.filter((w) => !['closed', 'cancelled', 'completed'].includes(w.status))
  const wipValue = activeWos.reduce((s, w) => {
    const lines = useWorkOrderStore.getState().getWoMaterials(w.id)
    return s + lines.reduce((ls, l) => ls + l.issuedQty * (getItem(l.itemId)?.standardRate ?? 0), 0)
  }, 0)

  const productionValue = activeWos.reduce((s, w) => {
    const product = getProduct(w.productId)
    return s + w.qty * (product?.standardCost.totalCost ?? 0)
  }, 0)

  const fgWarehouseIds = new Set(useMasterStore.getState().warehouses.filter((w) => w.warehouseType === 'fg').map((w) => w.id))
  const fgValue = stock.filter((p) => fgWarehouseIds.has(p.warehouseId)).reduce((s, p) => s + p.onHand * (getItem(p.itemId)?.standardRate ?? 0), 0)

  const pendingDispatch = dispatches.filter((d) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status))
  const dispatchValue = pendingDispatch.reduce((s, d) => s + (getProduct(d.productId)?.standardPrice ?? 0), 0)

  const varianceRows = useCostingStore.getState().getVarianceReport()
  const costVariance = varianceRows.reduce((s, r) => s + Math.abs(r.varianceAmount), 0)

  const delayedOrders = openOrders.filter((so) => so.requiredDate < today()).length + usePurchaseStore.getState().getDelayedPoReport().length
  const runningWos = workOrders.filter((w) => w.status === 'in_production').length
  const capacityUtil = activeWos.length > 0 ? Math.min(100, Math.round((runningWos / activeWos.length) * 100)) : 0

  const traffic: 'green' | 'amber' | 'red' =
    qc.openNcr > 2 || delayedOrders > 3 ? 'red' : delayedOrders > 0 || mrp.materialShortages > 0 ? 'amber' : 'green'

  return {
    orderBookValue,
    orderBookCount: openOrders.length,
    productionValue,
    wipValue,
    fgValue,
    dispatchValue,
    invoiceValue: invMetrics.totalInvoiced,
    paymentReceived: invMetrics.totalCollected,
    outstanding: invMetrics.totalReceivable,
    openNcr: qc.openNcr,
    delayedOrders,
    costVariance,
    capacityUtil,
    revenue: invMetrics.totalCollected,
    traffic,
    openOrders: openOrders.slice(0, 8),
    lateWos: workOrders.filter(isLateWo).slice(0, 6),
  }
}

export function useExecutiveDashboard() {
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const inspections = useQualityStore((s) => s.inspections)
  const ncrs = useQualityStore((s) => s.ncrs)
  const mrpRuns = useMrpStore((s) => s.runs)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const items = useMasterStore((s) => s.items)
  const invoices = useInvoiceStore((s) => s.invoices)

  return useMemo(
    () => getExecutiveDashboardData(),
    [salesOrders, workOrders, purchaseOrders, dispatches, inspections, ncrs, mrpRuns, stockMovements, items, invoices],
  )
}

export type InboxItem = {
  id: string
  kind: 'approval' | 'task' | 'alert' | 'work'
  title: string
  description: string
  severity: 'green' | 'amber' | 'red'
  href: string
  module: string
  dueDate?: string
}

export function getUnifiedInboxData() {
  const jobCards = useWorkOrderStore.getState().jobCards
  const workOrders = useWorkOrderStore.getState().workOrders
  const purchaseOrders = usePurchaseStore.getState().purchaseOrders
  const dispatches = useDispatchStore.getState().dispatches
  const invoices = useInvoiceStore.getState().invoices

  const approvals: InboxItem[] = []
  const tasks: InboxItem[] = []
  const alerts: InboxItem[] = []

  for (const pr of usePurchaseStore.getState().getPendingPrReport().filter((p) => p.status === 'submitted')) {
    approvals.push({ id: `pr-${pr.prId}`, kind: 'approval', title: `Approve PR ${pr.prNo}`, description: `${pr.lineCount} lines · ${pr.source}`, severity: 'amber', href: `/purchase/requisitions/${pr.prId}`, module: 'Procurement' })
  }

  const user = getSessionUser()
  for (const req of listPendingApprovalsForUser(user)) {
    const step = req.steps[req.currentStepIndex]
    let href = '/purchase/approvals'
    if (req.documentType === 'purchase_order') href = `/purchase/orders/${req.entityId}`
    if (req.documentType === 'bom_revision') href = `/manufacturing/setup/boms`
    if (req.documentType === 'cost_override') href = `/masters/products/${req.entityId}`
    approvals.push({
      id: `apreq-${req.id}`,
      kind: 'approval',
      title: `${step?.approverLabel ?? 'Approve'} — ${req.entityLabel}`,
      description: step?.ruleLabel ?? APPROVAL_DOCUMENT_LABELS[req.documentType],
      severity: 'amber',
      href,
      module: req.documentType === 'cost_override' ? 'Finance' : req.documentType === 'bom_revision' ? 'Engineering' : 'Procurement',
    })
  }

  for (const po of purchaseOrders.filter((p) => p.status === 'submitted')) {
    const req = useApprovalStore.getState().getActiveRequest('purchase_order', po.id)
    if (req && req.steps.length > 0) continue
    const vendorName = useMasterStore.getState().getVendor(po.vendorId)?.vendorName ?? po.vendorId
    approvals.push({ id: `po-${po.id}`, kind: 'approval', title: `Approve PO ${po.poNo}`, description: vendorName, severity: 'amber', href: `/purchase/orders/${po.id}`, module: 'Procurement' })
  }

  const crmDocs = useCrmStore.getState().quotationDocuments
  for (const doc of crmDocs.filter((d) => d.status === 'pending_approval')) {
    approvals.push({
      id: `crm-quo-${doc.id}`,
      kind: 'approval',
      title: `Approve CRM quotation ${doc.quotationId}`,
      description: `Rev ${doc.revisionNo} · ${formatCrmCurrency(doc.totalAmount)}`,
      severity: 'amber',
      href: `/crm/quotations/${doc.id}`,
      module: 'CRM',
    })
  }

  for (const q of useSalesStore.getState().getPendingCustomerApprovals()) {
    const crmDoc = crmDocs.find((d) => d.quotationId === q.id && d.revisionNo === q.revisionNo)
    approvals.push({
      id: `quo-${q.id}`,
      kind: 'approval',
      title: `Customer approval — ${q.quotationNo}`,
      description: `Rev ${q.revisionNo} pending sign-off`,
      severity: 'amber',
      href: crmDoc ? `/crm/quotations/${crmDoc.id}` : '/crm/quotations',
      module: 'CRM',
    })
  }
  for (const jc of jobCards.filter((j) => ['pending', 'assigned', 'in_progress'].includes(j.status))) {
    tasks.push({ id: `jc-${jc.id}`, kind: 'task', title: `${jc.jobCardNo} · ${jc.operationName}`, description: `${jc.woNo} · ${jc.workCenterCode}`, severity: jc.status === 'in_progress' ? 'green' : 'amber', href: '/manufacturing/work-orders', module: 'Shop Floor' })
  }
  for (const insp of useQualityStore.getState().getPendingInspections()) {
    tasks.push({ id: `qc-${insp.id}`, kind: 'task', title: `QC — ${insp.inspectionNo}`, description: `${insp.woNo ?? 'Incoming'} · ${insp.status}`, severity: 'amber', href: `/quality/inspections/${insp.id}`, module: 'Quality' })
  }
  for (const n of buildNotifications() as NotificationItem[]) {
    alerts.push({ id: n.id, kind: 'alert', title: n.title, description: n.description, severity: n.severity, href: n.href ?? '/', module: n.type })
  }
  for (const d of dispatches.filter((x) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(x.status)).slice(0, 6)) {
    alerts.push({ id: `disp-${d.id}`, kind: 'alert', title: `Dispatch pending — ${d.dispatchNo}`, description: d.status, severity: 'amber', href: `/dispatch/${d.id}`, module: 'Dispatch' })
  }
  for (const inv of invoices.filter((i) => i.balanceDue > 0).slice(0, 6)) {
    alerts.push({ id: `pay-${inv.id}`, kind: 'alert', title: `Payment pending — ${inv.invoiceNo}`, description: `Balance due`, severity: inv.paymentStatus === 'overdue' ? 'red' : 'amber', href: `/accounting/money-in/invoices/${inv.id}`, module: 'Finance' })
  }
  for (const w of workOrders.filter(isLateWo).slice(0, 6)) {
    alerts.push({ id: `late-wo-${w.id}`, kind: 'alert', title: `Delayed WO — ${w.woNo}`, description: `Planned finish ${w.plannedFinishDate}`, severity: 'red', href: wo360Path(w.id), module: 'Production' })
  }

  const work = [...approvals, ...tasks, ...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))

  return {
    approvals,
    tasks,
    alerts,
    work,
    counts: {
      approvals: approvals.length,
      tasks: tasks.length,
      alerts: alerts.length,
      work: work.length,
      qcPending: useQualityStore.getState().getPendingInspections().length,
      poApprovalPending: purchaseOrders.filter((p) => p.status === 'submitted').length,
      dispatchPending: dispatches.filter((d) => !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status)).length,
      paymentPending: invoices.filter((i) => i.balanceDue > 0).length,
      delayedWorkOrders: workOrders.filter(isLateWo).length,
    },
  }
}

export function useUnifiedInbox() {
  const requisitions = usePurchaseStore((s) => s.requisitions)
  const quotations = useSalesStore((s) => s.quotations)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const inspections = useQualityStore((s) => s.inspections)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const invoices = useInvoiceStore((s) => s.invoices)
  const mrpRuns = useMrpStore((s) => s.runs)

  return useMemo(
    () => getUnifiedInboxData(),
    [requisitions, quotations, quotationDocuments, jobCards, inspections, workOrders, purchaseOrders, dispatches, invoices, mrpRuns],
  )
}

function severityRank(s: 'green' | 'amber' | 'red') {
  if (s === 'red') return 3
  if (s === 'amber') return 2
  return 1
}

export function useShopFloorQueue(teamFilter?: string) {
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)

  return useMemo(() => {
    const activeWoIds = new Set(workOrders.filter((w) => w.status === 'in_production').map((w) => w.id))
    let queue = jobCards.filter((j) => activeWoIds.has(j.workOrderId) && j.status !== 'completed')
    if (teamFilter) queue = queue.filter((j) => !j.assignedTeam || j.assignedTeam === teamFilter || j.status === 'pending')
    queue = [...queue].sort((a, b) => {
      const order: Record<JobCard['status'], number> = { in_progress: 0, qc_hold: 1, assigned: 2, pending: 3, completed: 4 }
      return (order[a.status] ?? 5) - (order[b.status] ?? 5) || a.sequenceNo - b.sequenceNo
    })
    return {
      queue,
      inProgress: queue.filter((j) => j.status === 'in_progress').length,
      pending: queue.filter((j) => ['pending', 'assigned'].includes(j.status)).length,
      qcHold: queue.filter((j) => j.status === 'qc_hold').length,
      getOperation: (id: string): WorkOrderProductionOperation | undefined => productionOperations.find((o) => o.id === id),
    }
  }, [jobCards, workOrders, productionOperations, teamFilter])
}
