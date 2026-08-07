/**
 * Store Operations facade — KPI dashboard + queues.
 * Composes inventory balances, ledger, purchase GRN queues, and inventory store-workbench API.
 * Does NOT write stock tables; all posts go through existing engines via deep links.
 */
import {
  getInventoryStoreWorkbenchSummary,
  listInventoryStoreNeedsAction,
  type StoreNeedsActionRow,
  type InventoryStoreWorkbenchSummary,
} from '../api/inventoryStoreWorkbenchApi'
import { listInventoryLedger, type InventoryStockMovement } from '../api/inventoryApi'
import { listDashboardStockAlerts, listWarehouseOpsSummaries } from './operationalViewsService'
import type { ConsolidatedStockRow, ItemTimelineEvent } from '../../types/operationalStockViews'

export type StoreDashKpi = {
  id: string
  label: string
  value: number
  tone: 'default' | 'warning' | 'critical' | 'ok'
  href: string
}

export type StoreDashboardData = {
  asOf: string
  kpis: StoreDashKpi[]
  queue: StoreNeedsActionRow[]
  lowStock: ConsolidatedStockRow[]
  negativeStock: ConsolidatedStockRow[]
  todayMoves: ItemTimelineEvent[]
  rawSummary: InventoryStoreWorkbenchSummary | null
}

function emptyManuKpis() {
  return {
    waitingReservation: 0,
    waitingIssue: 0,
    waitingReturns: 0,
    waitingWip: 0,
    waitingFg: 0,
    activeWoReservations: 0,
  }
}

function countCategory(rows: StoreNeedsActionRow[], categories: string[]): number {
  return rows.filter((r) => categories.includes(r.category)).length
}

function countDomain(rows: StoreNeedsActionRow[], domain: string): number {
  return rows.filter((r) => r.domain === domain).length
}

function mapTodayMoves(rows: InventoryStockMovement[], asOf: string): ItemTimelineEvent[] {
  const today = new Date().toISOString().slice(0, 10)
  return rows
    .filter(
      (m) =>
        String(m.movementDate ?? '').startsWith(today) || String(m.createdAt ?? '').startsWith(today),
    )
    .slice(0, 15)
    .map((m) => ({
      id: m.id,
      at: m.movementDate ?? m.createdAt ?? asOf,
      kind: String(m.movementType).includes('ISSUE')
        ? ('issue' as const)
        : String(m.referenceType).includes('GRN')
          ? ('grn' as const)
          : ('other' as const),
      title: `${m.movementType} · ${m.movementNumber}`,
      subtitle: m.item ? `${m.item.code} — ${m.item.name}` : m.itemId,
      href: `/inventory/ledger`,
      qty: Number(m.quantity ?? 0),
    }))
}

export async function getStoreDashboard(): Promise<StoreDashboardData> {
  const asOfFallback = new Date().toISOString()

  // All data sources in parallel — never wait on full consolidated stock (PO/GRN fan-out).
  const [alerts, workbench, ledgerRes] = await Promise.all([
    listDashboardStockAlerts(12).catch(() => ({
      lowStock: [] as ConsolidatedStockRow[],
      negativeStock: [] as ConsolidatedStockRow[],
      lowStockCount: 0,
      negativeStockCount: 0,
    })),
    Promise.all([
      getInventoryStoreWorkbenchSummary().catch(() => null),
      listInventoryStoreNeedsAction({ limit: 80 }).catch(() => null),
    ]).then(([sumRes, needsRes]) => ({
      rawSummary: sumRes?.data ?? null,
      queue: needsRes?.data?.rows ?? ([] as StoreNeedsActionRow[]),
      asOf: sumRes?.data?.asOf ?? needsRes?.data?.asOf ?? asOfFallback,
    })),
    listInventoryLedger({ page: 1, limit: 30 }).catch(() => null),
  ])

  const { lowStock, negativeStock, lowStockCount, negativeStockCount } = alerts
  const queue = workbench.queue
  const rawSummary = workbench.rawSummary
  const asOf = workbench.asOf

  const ledgerRows = ledgerRes
    ? Array.isArray(ledgerRes)
      ? ledgerRes
      : ((ledgerRes as { data?: InventoryStockMovement[] }).data ?? [])
    : []
  const todayMoves = mapTodayMoves(ledgerRows, asOf)

  const mfg = rawSummary?.manufacturing?.kpis ?? emptyManuKpis()
  const qcPending = countCategory(queue, ['GRN_QC_PENDING', 'PURCHASE_QI_OPEN'])
  const pendingGrn = qcPending + countCategory(queue, ['GRN_POSTING_PENDING'])
  const pendingPutAway = countCategory(queue, ['GRN_POSTING_PENDING'])
  const pendingIssue = mfg.waitingIssue + countCategory(queue, ['WO_ISSUE_PENDING'])
  const pendingTransfer = countDomain(queue, 'transfers')
  const pendingCount = countDomain(queue, 'stock-counts')
  const reservations = mfg.activeWoReservations + mfg.waitingReservation
  const todayReceipt = todayMoves.filter((m) => m.kind === 'grn').length
  const todayIssue = todayMoves.filter((m) => m.kind === 'issue').length

  // Operator daily-view order: QC → Put Away → today's flow → Low Stock first,
  // register-level pending counts follow as secondary detail.
  const kpis: StoreDashKpi[] = [
    {
      id: 'qcPending',
      label: 'QC Pending',
      value: qcPending,
      tone: qcPending > 0 ? 'warning' : 'ok',
      href: '/quality/incoming',
    },
    {
      id: 'pendingPutAway',
      label: 'Pending Put Away',
      value: pendingPutAway,
      tone: pendingPutAway > 0 ? 'warning' : 'ok',
      href: '/inventory/store/put-away',
    },
    {
      id: 'todayReceipt',
      label: "Today's Receipt",
      value: todayReceipt,
      tone: 'default',
      href: '/inventory/store/timeline',
    },
    {
      id: 'todayIssue',
      label: "Today's Issue",
      value: todayIssue,
      tone: 'default',
      href: '/inventory/store/timeline',
    },
    {
      id: 'lowStock',
      label: 'Low Stock',
      value: lowStockCount,
      tone: lowStockCount > 0 ? 'warning' : 'ok',
      href: '/inventory/stock?lowStock=1',
    },
    {
      id: 'pendingGrn',
      label: 'Pending GRN',
      value: pendingGrn,
      tone: pendingGrn > 0 ? 'warning' : 'ok',
      href: '/purchase/grn',
    },
    {
      id: 'pendingIssue',
      label: 'Pending Issue',
      value: pendingIssue,
      tone: pendingIssue > 0 ? 'warning' : 'ok',
      href: '/inventory/store/issue',
    },
    {
      id: 'pendingTransfer',
      label: 'Pending Transfer',
      value: pendingTransfer,
      tone: pendingTransfer > 0 ? 'warning' : 'ok',
      href: '/inventory/store/transfer',
    },
    {
      id: 'pendingCount',
      label: 'Pending Count',
      value: pendingCount,
      tone: pendingCount > 0 ? 'warning' : 'ok',
      href: '/inventory/store/count',
    },
    {
      id: 'reservations',
      label: 'Reservations',
      value: reservations,
      tone: reservations > 0 ? 'default' : 'ok',
      href: '/inventory/store/reservations',
    },
    {
      id: 'negativeStock',
      label: 'Negative Stock',
      value: negativeStockCount,
      tone: negativeStockCount > 0 ? 'critical' : 'ok',
      href: '/inventory/stock',
    },
  ]

  return {
    asOf,
    kpis,
    queue: queue.slice(0, 40),
    lowStock,
    negativeStock,
    todayMoves,
    rawSummary,
  }
}

export type StoreTotals = {
  totalItems: number
  totalStockQty: number
}

/**
 * Total Items / Total Stock Qty — fetched separately from the main dashboard
 * payload since it aggregates the full item × warehouse register (heavier
 * than the needs-action queue) and must never block the primary KPI render.
 */
export async function getStoreTotals(): Promise<StoreTotals> {
  const warehouses = await listWarehouseOpsSummaries()
  return warehouses.reduce<StoreTotals>(
    (acc, w) => ({
      totalItems: acc.totalItems + w.totalItems,
      totalStockQty: acc.totalStockQty + w.totalStockQty,
    }),
    { totalItems: 0, totalStockQty: 0 },
  )
}
