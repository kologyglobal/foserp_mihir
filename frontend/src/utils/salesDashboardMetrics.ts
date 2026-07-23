import type { SalesOrder } from '../types/mrp'
import type { WorkOrder } from '../types/workorder'
import type { QcInspection } from '../types/quality'

export type SalesExecutionStageId =
  | 'draft'
  | 'confirmed'
  | 'in_production'
  | 'dispatch_ready'
  | 'dispatched'
  | 'invoiced'

export interface SalesExecutionStage {
  id: SalesExecutionStageId
  label: string
  shortLabel: string
  count: number
  value: number
  href: string
  riskCount: number
}

export interface SalesAtRiskOrder {
  id: string
  salesOrderNo: string
  customerId: string
  requiredDate: string
  status: SalesOrder['status']
  grandTotal: number
  riskReason: string
  severity: 'critical' | 'high' | 'medium'
}

export interface SalesStatusChartRow {
  label: string
  shortLabel: string
  status: SalesOrder['status']
  count: number
  value: number
}

export interface SalesDeliveryBucket {
  label: string
  count: number
  overdue: number
}

const ACTIVE_STATUSES = new Set<SalesOrder['status']>([
  'open',
  'confirmed',
  'in_production',
  'ready_dispatch',
  'dispatched',
])

function orderValue(so: SalesOrder): number {
  return so.grandTotal ?? (so.unitPrice != null ? so.unitPrice * so.qty : 0)
}

function hasActiveWorkOrder(soId: string, workOrders: WorkOrder[]): boolean {
  return workOrders.some(
    (w) =>
      w.salesOrderId === soId &&
      ['released', 'in_progress', 'in_production', 'material_reserved', 'partially_issued', 'fully_issued'].includes(w.status),
  )
}

function hasQcHold(soId: string, workOrders: WorkOrder[], inspections: QcInspection[]): boolean {
  const woIds = workOrders.filter((w) => w.salesOrderId === soId).map((w) => w.id)
  return inspections.some((i) => i.workOrderId != null && woIds.includes(i.workOrderId) && i.status === 'pending')
}

function classifyOrder(
  so: SalesOrder,
  workOrders: WorkOrder[],
): SalesExecutionStageId {
  if (so.status === 'invoiced' || so.status === 'closed') return 'invoiced'
  if (so.status === 'dispatched') return 'dispatched'
  if (so.status === 'ready_dispatch') return 'dispatch_ready'
  if (so.status === 'in_production' || hasActiveWorkOrder(so.id, workOrders)) return 'in_production'
  if (so.status === 'confirmed') return 'confirmed'
  return 'draft'
}

const STAGE_META: Record<
  SalesExecutionStageId,
  { label: string; shortLabel: string; href: string }
> = {
  draft: { label: 'Draft SO', shortLabel: 'Draft', href: '/sales/orders?status=open' },
  confirmed: { label: 'Confirmed', shortLabel: 'Confirmed', href: '/sales/orders?status=confirmed' },
  in_production: { label: 'In Production', shortLabel: 'Production', href: '/manufacturing/work-orders' },
  dispatch_ready: { label: 'Dispatch Ready', shortLabel: 'Dispatch', href: '/dispatch/register' },
  dispatched: { label: 'Dispatched', shortLabel: 'Shipped', href: '/dispatch/register' },
  invoiced: { label: 'Invoiced / Closed', shortLabel: 'Invoiced', href: '/accounting/money-in/invoices' },
}

export function buildSalesExecutionStages(
  salesOrders: SalesOrder[],
  workOrders: WorkOrder[],
  inspections: QcInspection[],
): SalesExecutionStage[] {
  const buckets = new Map<SalesExecutionStageId, { count: number; value: number; risk: number }>()
  for (const id of Object.keys(STAGE_META) as SalesExecutionStageId[]) {
    buckets.set(id, { count: 0, value: 0, risk: 0 })
  }

  for (const so of salesOrders) {
    const stageId = classifyOrder(so, workOrders)
    const bucket = buckets.get(stageId)!
    bucket.count += 1
    bucket.value += orderValue(so)
    if (ACTIVE_STATUSES.has(so.status) && hasQcHold(so.id, workOrders, inspections)) {
      bucket.risk += 1
    }
  }

  return (Object.keys(STAGE_META) as SalesExecutionStageId[]).map((id) => {
    const meta = STAGE_META[id]
    const b = buckets.get(id)!
    return {
      id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      count: b.count,
      value: b.value,
      href: meta.href,
      riskCount: b.risk,
    }
  })
}

export function buildSalesAtRiskOrders(
  salesOrders: SalesOrder[],
  workOrders: WorkOrder[],
  inspections: QcInspection[],
): SalesAtRiskOrder[] {
  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date()
  in14.setDate(in14.getDate() + 14)
  const soon = in14.toISOString().slice(0, 10)

  const risks: SalesAtRiskOrder[] = []

  for (const so of salesOrders) {
    if (!ACTIVE_STATUSES.has(so.status)) continue

    let riskReason = ''
    let severity: SalesAtRiskOrder['severity'] = 'medium'
    const required = so.requiredDate?.slice(0, 10) ?? ''

    if (required && required < today) {
      riskReason = 'Past delivery commitment'
      severity = 'critical'
    } else if (required && required <= soon && ['open', 'confirmed'].includes(so.status)) {
      riskReason = 'Delivery within 14 days — not in production'
      severity = 'high'
    } else if (hasQcHold(so.id, workOrders, inspections)) {
      riskReason = 'QC hold on linked work order'
      severity = 'high'
    } else if (so.status === 'confirmed' && !hasActiveWorkOrder(so.id, workOrders)) {
      riskReason = 'Confirmed — MRP / WO not started'
      severity = 'medium'
    } else {
      continue
    }

    risks.push({
      id: so.id,
      salesOrderNo: so.salesOrderNo,
      customerId: so.customerId,
      requiredDate: required || so.requiredDate || '',
      status: so.status,
      grandTotal: orderValue(so),
      riskReason,
      severity,
    })
  }

  const rank = { critical: 0, high: 1, medium: 2 }
  return risks.sort((a, b) => rank[a.severity] - rank[b.severity] || a.requiredDate.localeCompare(b.requiredDate))
}

export function buildSalesStatusChartData(salesOrders: SalesOrder[]): SalesStatusChartRow[] {
  const labels: Record<SalesOrder['status'], string> = {
    open: 'Draft',
    pending_so: 'Pending SO',
    confirmed: 'Confirmed',
    in_production: 'In Production',
    ready_dispatch: 'Dispatch Ready',
    dispatched: 'Dispatched',
    invoiced: 'Invoiced',
    closed: 'Closed',
  }

  const map = new Map<SalesOrder['status'], { count: number; value: number }>()
  for (const so of salesOrders) {
    const cur = map.get(so.status) ?? { count: 0, value: 0 }
    cur.count += 1
    cur.value += orderValue(so)
    map.set(so.status, cur)
  }

  return (Object.keys(labels) as SalesOrder['status'][])
    .map((status) => {
      const data = map.get(status) ?? { count: 0, value: 0 }
      return {
        label: labels[status],
        shortLabel: labels[status],
        status,
        count: data.count,
        value: data.value,
      }
    })
    .filter((r) => r.count > 0)
}

export function buildSalesDeliveryBuckets(salesOrders: SalesOrder[]): SalesDeliveryBucket[] {
  const today = new Date().toISOString().slice(0, 10)
  const buckets = new Map<string, { count: number; overdue: number }>()

  for (const so of salesOrders) {
    if (!ACTIVE_STATUSES.has(so.status)) continue
    const required = so.requiredDate?.slice(0, 10)
    if (!required) continue
    const month = required.slice(0, 7)
    const label = new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const cur = buckets.get(label) ?? { count: 0, overdue: 0 }
    cur.count += 1
    if (required < today) cur.overdue += 1
    buckets.set(label, cur)
  }

  return [...buckets.entries()]
    .map(([label, data]) => ({ label, ...data }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function computeSalesHealthScore(input: {
  atRiskCount: number
  ordersPendingMrp: number
  ordersOnQcHold: number
  overdueDeliveries: number
}): number {
  const penalty =
    input.overdueDeliveries * 12 +
    input.ordersOnQcHold * 8 +
    input.ordersPendingMrp * 4 +
    input.atRiskCount * 3
  return Math.max(0, Math.min(100, Math.round(92 - penalty)))
}

export function buildPendingMrpOrders(
  salesOrders: SalesOrder[],
  workOrders: WorkOrder[],
): SalesOrder[] {
  return salesOrders.filter(
    (so) => so.status === 'confirmed' && !workOrders.some((w) => w.salesOrderId === so.id),
  )
}

export function sumActiveOrderBook(salesOrders: SalesOrder[]): number {
  return salesOrders
    .filter((so) => ACTIVE_STATUSES.has(so.status))
    .reduce((s, o) => s + orderValue(o), 0)
}

export function getSalesOrderFulfillmentLabel(so: SalesOrder, workOrders: WorkOrder[]): string {
  if (so.status === 'pending_so') return 'Awaiting SO'
  if (so.status === 'open') return 'Draft'
  if (so.status === 'confirmed' && !workOrders.some((w) => w.salesOrderId === so.id)) return 'Awaiting MRP'
  if (so.status === 'in_production' || workOrders.some((w) => w.salesOrderId === so.id)) return 'Production'
  if (so.status === 'ready_dispatch') return 'Dispatch ready'
  if (so.status === 'dispatched') return 'Dispatched'
  if (so.status === 'invoiced' || so.status === 'closed') return 'Complete'
  return so.status.replace(/_/g, ' ')
}

export function isSalesOrderOverdue(so: SalesOrder): boolean {
  if (so.status === 'pending_so') return false
  const required = so.requiredDate?.slice(0, 10)
  if (!required) return false
  const today = new Date().toISOString().slice(0, 10)
  return required < today && !['dispatched', 'closed', 'invoiced'].includes(so.status)
}

const SALES_ORDER_STATUS_ORDER: SalesOrder['status'][] = [
  'pending_so',
  'open',
  'confirmed',
  'in_production',
  'ready_dispatch',
  'dispatched',
  'invoiced',
  'closed',
]

export type SalesOrderSortKey =
  | 'lastModified'
  | 'orderDate'
  | 'requiredDate'
  | 'value'
  | 'customer'
  | 'status'
  | 'soNo'

function salesOrderLastTouched(so: SalesOrder): string {
  return so.modifiedAt || so.createdAt || so.orderDate || ''
}

export function sortSalesOrders(
  rows: SalesOrder[],
  sortBy: SalesOrderSortKey,
  resolveValue: (so: SalesOrder) => number,
  resolveCustomerName: (customerId: string) => string,
): SalesOrder[] {
  const sorted = [...rows]
  const statusRank = (status: SalesOrder['status']) => {
    const i = SALES_ORDER_STATUS_ORDER.indexOf(status)
    return i >= 0 ? i : SALES_ORDER_STATUS_ORDER.length
  }

  switch (sortBy) {
    case 'lastModified':
      sorted.sort((a, b) => salesOrderLastTouched(b).localeCompare(salesOrderLastTouched(a)))
      break
    case 'requiredDate':
      sorted.sort((a, b) => (a.requiredDate || '9999-12-31').localeCompare(b.requiredDate || '9999-12-31'))
      break
    case 'value':
      sorted.sort((a, b) => resolveValue(b) - resolveValue(a))
      break
    case 'customer':
      sorted.sort((a, b) => resolveCustomerName(a.customerId).localeCompare(resolveCustomerName(b.customerId)))
      break
    case 'status':
      sorted.sort((a, b) => statusRank(a.status) - statusRank(b.status))
      break
    case 'soNo':
      sorted.sort((a, b) => b.salesOrderNo.localeCompare(a.salesOrderNo))
      break
    case 'orderDate':
    default:
      sorted.sort((a, b) => {
        const ad = a.orderDate ?? a.createdAt ?? ''
        const bd = b.orderDate ?? b.createdAt ?? ''
        return bd.localeCompare(ad)
      })
      break
  }
  return sorted
}
