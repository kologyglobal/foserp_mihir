import type {
  DeliveryCommitmentRow,
  NegativeStockRow,
  OpenSalesOrderRow,
  ReworkTrendRow,
  SlowMovingRow,
  StockAgeBucket,
  StockAgingRow,
  WipAgingRow,
  WoStatusRow,
} from '../types/reports'
import type { StockMovement } from '../types/inventory'
import type { WorkOrderStatus } from '../types/workorder'
import type { SalesOrder } from '../types/mrp'
import { useInventoryStore } from '../store/inventoryStore'
import { useMasterStore } from '../store/masterStore'
import { usePurchaseStore } from '../store/purchaseStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useQualityStore } from '../store/qualityStore'
import { useDispatchStore } from '../store/dispatchStore'
import { useMrpStore } from '../store/mrpStore'

const MS_PER_DAY = 86400000
const SLOW_MOVING_DAYS = 90

function daysBetween(from: string, to: Date = new Date()): number {
  const a = new Date(from.slice(0, 10)).getTime()
  const b = new Date(to.toISOString().slice(0, 10)).getTime()
  return Math.max(0, Math.floor((b - a) / MS_PER_DAY))
}

function ageBucket(days: number): StockAgeBucket {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

function lastMovementDate(movements: StockMovement[], itemId: string, warehouseId: string): string | null {
  const rows = movements
    .filter((m) => m.itemId === itemId && m.warehouseId === warehouseId)
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.createdAt.localeCompare(a.createdAt))
  return rows[0]?.movementDate ?? null
}

function lastIssueDate(movements: StockMovement[], itemId: string, warehouseId: string): string | null {
  const rows = movements
    .filter((m) => m.itemId === itemId && m.warehouseId === warehouseId && m.movementType === 'issue')
    .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
  return rows[0]?.movementDate ?? null
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

const WIP_STATUSES: WorkOrderStatus[] = [
  'released',
  'material_reserved',
  'partially_issued',
  'fully_issued',
  'in_production',
]

const ACTIVE_WO_STATUSES: WorkOrderStatus[] = [
  'draft',
  'planned',
  'released',
  'material_reserved',
  'partially_issued',
  'fully_issued',
  'in_production',
  'completed',
  'fg_received',
]

const OPEN_SO_STATUSES: SalesOrder['status'][] = [
  'open',
  'confirmed',
  'in_production',
  'ready_dispatch',
  'dispatched',
]

export function getStockAgingReport(): StockAgingRow[] {
  const inv = useInventoryStore.getState()
  const master = useMasterStore.getState()
  const rows: StockAgingRow[] = []

  for (const item of master.items.filter((i) => i.isActive)) {
    for (const wh of master.warehouses.filter((w) => w.isActive)) {
      const onHand = inv.getOnHand(item.id, wh.id)
      if (onHand <= 0) continue
      const lastDate = lastMovementDate(inv.stockMovements, item.id, wh.id) ?? new Date().toISOString().slice(0, 10)
      const ageDays = daysBetween(lastDate)
      rows.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        warehouseCode: wh.warehouseCode,
        warehouseName: wh.warehouseName,
        onHand,
        uomCode: master.uoms.find((u) => u.id === item.baseUomId)?.uomCode ?? '—',
        stockValue: onHand * item.standardRate,
        lastMovementDate: lastDate,
        ageDays,
        ageBucket: ageBucket(ageDays),
      })
    }
  }

  return rows.sort((a, b) => b.ageDays - a.ageDays)
}

export function getNegativeStockReport(): NegativeStockRow[] {
  const inv = useInventoryStore.getState()
  const master = useMasterStore.getState()
  const rows: NegativeStockRow[] = []

  for (const item of master.items) {
    for (const wh of master.warehouses) {
      const onHand = inv.getOnHand(item.id, wh.id)
      if (onHand >= 0) continue
      rows.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        warehouseCode: wh.warehouseCode,
        onHand,
        uomCode: master.uoms.find((u) => u.id === item.baseUomId)?.uomCode ?? '—',
        lastMovementDate: lastMovementDate(inv.stockMovements, item.id, wh.id) ?? '—',
      })
    }
  }

  return rows.sort((a, b) => a.onHand - b.onHand)
}

export function getSlowMovingReport(thresholdDays = SLOW_MOVING_DAYS): SlowMovingRow[] {
  const inv = useInventoryStore.getState()
  const master = useMasterStore.getState()
  const rows: SlowMovingRow[] = []

  for (const item of master.items.filter((i) => i.isActive)) {
    for (const wh of master.warehouses.filter((w) => w.isActive)) {
      const onHand = inv.getOnHand(item.id, wh.id)
      if (onHand <= 0) continue
      const lastIssue = lastIssueDate(inv.stockMovements, item.id, wh.id)
      const daysSinceIssue = lastIssue ? daysBetween(lastIssue) : 999
      if (daysSinceIssue < thresholdDays) continue
      rows.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        warehouseCode: wh.warehouseCode,
        onHand,
        uomCode: master.uoms.find((u) => u.id === item.baseUomId)?.uomCode ?? '—',
        stockValue: onHand * item.standardRate,
        lastIssueDate: lastIssue,
        daysSinceIssue: lastIssue ? daysSinceIssue : -1,
      })
    }
  }

  return rows.sort((a, b) => b.daysSinceIssue - a.daysSinceIssue)
}

export function getWoStatusReport(): WoStatusRow[] {
  const woStore = useWorkOrderStore.getState()
  const master = useMasterStore.getState()
  const today = new Date().toISOString().slice(0, 10)

  return woStore.workOrders
    .filter((w) => ACTIVE_WO_STATUSES.includes(w.status))
    .map((w) => ({
      woId: w.id,
      woNo: w.woNo,
      salesOrderNo: w.salesOrderNo,
      productName: master.getProduct(w.productId)?.productName ?? '—',
      outputItemCode: w.outputItemCode,
      qty: w.qty,
      status: w.status,
      plannedStartDate: w.plannedStartDate,
      plannedFinishDate: w.plannedFinishDate,
      isOverdue: w.plannedFinishDate < today && !['completed', 'fg_received', 'closed'].includes(w.status),
    }))
    .sort((a, b) => a.plannedFinishDate.localeCompare(b.plannedFinishDate))
}

export function getWipAgingReport(): WipAgingRow[] {
  const woStore = useWorkOrderStore.getState()
  const master = useMasterStore.getState()
  const today = new Date().toISOString().slice(0, 10)

  return woStore.workOrders
    .filter((w) => WIP_STATUSES.includes(w.status))
    .map((w) => {
      const wipStart = w.releasedAt?.slice(0, 10) ?? w.plannedStartDate
      const ageDays = daysBetween(wipStart)
      const daysOverdue = w.plannedFinishDate < today ? daysBetween(w.plannedFinishDate, new Date(today)) : 0
      return {
        woId: w.id,
        woNo: w.woNo,
        salesOrderNo: w.salesOrderNo,
        productName: master.getProduct(w.productId)?.productName ?? '—',
        status: w.status,
        wipStartDate: wipStart,
        ageDays,
        plannedFinishDate: w.plannedFinishDate,
        daysOverdue,
      }
    })
    .sort((a, b) => b.ageDays - a.ageDays)
}

export function getReworkTrendReport(months = 6): ReworkTrendRow[] {
  const reworks = useQualityStore.getState().reworks
  const now = new Date()
  const periods: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return periods.map((period) => {
    const opened = reworks.filter((r) => monthKey(r.createdAt) === period).length
    const completed = reworks.filter(
      (r) => r.completedAt && monthKey(r.completedAt) === period,
    ).length
    const periodEnd = new Date(`${period}-28`)
    const openAtPeriodEnd = reworks.filter((r) => {
      const created = new Date(r.createdAt)
      if (created > periodEnd) return false
      if (r.completedAt && new Date(r.completedAt) <= periodEnd) return false
      return true
    }).length
    return { period, opened, completed, openAtPeriodEnd }
  })
}

function enrichSalesOrder(so: SalesOrder): OpenSalesOrderRow {
  const master = useMasterStore.getState()
  const today = new Date().toISOString().slice(0, 10)
  const diff = Math.floor(
    (new Date(so.requiredDate.slice(0, 10)).getTime() - new Date(today).getTime()) / MS_PER_DAY,
  )
  const isOverdue = diff < 0 && so.status !== 'closed' && so.status !== 'invoiced'
  return {
    salesOrderId: so.id,
    salesOrderNo: so.salesOrderNo,
    customerName: master.customers.find((c) => c.id === so.customerId)?.customerName ?? '—',
    productName: master.getProduct(so.productId)?.productName ?? '—',
    qty: so.qty,
    status: so.status,
    requiredDate: so.requiredDate,
    grandTotal: so.grandTotal ?? null,
    daysToDelivery: diff,
    isOverdue,
  }
}

export function getOpenSalesOrdersReport(): OpenSalesOrderRow[] {
  return useMrpStore
    .getState()
    .salesOrders.filter((so) => OPEN_SO_STATUSES.includes(so.status))
    .map(enrichSalesOrder)
    .sort((a, b) => a.requiredDate.localeCompare(b.requiredDate))
}

export function getDeliveryCommitmentsReport(horizonDays = 90): DeliveryCommitmentRow[] {
  const today = new Date()
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + horizonDays)
  const horizonStr = horizon.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)

  return useMrpStore
    .getState()
    .salesOrders.filter(
      (so) =>
        OPEN_SO_STATUSES.includes(so.status) &&
        so.requiredDate <= horizonStr,
    )
    .map((so) => {
      const row = enrichSalesOrder(so)
      let commitmentRisk: DeliveryCommitmentRow['commitmentRisk'] = 'on_track'
      if (so.requiredDate < todayStr) commitmentRisk = 'overdue'
      else if (so.requiredDate <= horizonStr && ['open', 'confirmed'].includes(so.status)) {
        commitmentRisk = 'at_risk'
      }
      return {
        salesOrderId: row.salesOrderId,
        salesOrderNo: row.salesOrderNo,
        customerName: row.customerName,
        productName: row.productName,
        qty: row.qty,
        requiredDate: row.requiredDate,
        status: row.status,
        commitmentRisk,
      }
    })
    .sort((a, b) => a.requiredDate.localeCompare(b.requiredDate))
}

export function getOpenPoReport() {
  return usePurchaseStore.getState().getOpenPoReport()
}

export function getDelayedPoReport() {
  return usePurchaseStore.getState().getDelayedPoReport()
}

export function getNcrAgeingReport() {
  return useQualityStore.getState().getNcrAgeingReport()
}

export function getPendingDispatchReport() {
  return useDispatchStore.getState().getPendingDispatchReport()
}

export function getPodPendingReport() {
  return useDispatchStore.getState().getPodPendingReport()
}
