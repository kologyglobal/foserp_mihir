/**
 * Live Store home dashboard — balances + recent ledger + production store queues.
 */
import { fetchItems, type ItemDto } from '../api/masterBatchApi'
import { fetchMasterWarehouses, mapWarehouseDto } from '../api/masterApi'
import {
  listInventoryBalances,
  listInventoryLedger,
  type InventoryStockBalance,
} from '../api/inventoryApi'
import { getStoreWorkbenchSummary } from '../api/manufacturingApi'
import { formatCurrency } from '../../utils/formatters/currency'
import type { InventoryDashboardData } from '../../types/inventoryDomain'

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

async function listAllBalances(): Promise<InventoryStockBalance[]> {
  const all: InventoryStockBalance[] = []
  let page = 1
  for (;;) {
    const res = await listInventoryBalances({ page, limit: 200 })
    all.push(...(res.data ?? []))
    const meta = res.meta as { totalPages?: number } | undefined
    if (!meta?.totalPages || page >= meta.totalPages) break
    page += 1
    if (page > 40) break
  }
  return all
}

export async function getLiveInventoryDashboard(): Promise<InventoryDashboardData> {
  const [items, warehouses, balances, ledgerRes, workbench] = await Promise.all([
    fetchItems().catch(() => [] as ItemDto[]),
    fetchMasterWarehouses().catch(() => [] as Awaited<ReturnType<typeof fetchMasterWarehouses>>),
    listAllBalances().catch(() => [] as InventoryStockBalance[]),
    listInventoryLedger({ page: 1, limit: 12 }).catch(() => ({ data: [] as Awaited<ReturnType<typeof listInventoryLedger>>['data'] })),
    getStoreWorkbenchSummary().catch(() => null),
  ])

  const itemById = new Map(items.map((i) => [i.id, i]))
  const whById = new Map(warehouses.map((w) => {
    const mapped = mapWarehouseDto(w)
    return [mapped.id, mapped] as const
  }))

  let totalValue = 0
  let availableQty = 0
  let qualityHoldQty = 0
  let lowStock = 0
  let outOfStock = 0

  const lowStockItems: InventoryDashboardData['lowStockItems'] = []
  const outOfStockItems: InventoryDashboardData['outOfStockItems'] = []
  const qualityHoldItems: InventoryDashboardData['qualityHoldItems'] = []
  const warehouseMap = new Map<string, { name: string; skuCount: number; value: number }>()

  for (const bal of balances) {
    const item = itemById.get(bal.itemId)
    const onHand = num(bal.onHandQty)
    const free = num(bal.freeQty)
    const hold = num(bal.qcHoldQty)
    const value = num(bal.stockValue)
    const reorder = num(item?.reorderLevel)
    totalValue += value
    availableQty += free
    qualityHoldQty += hold

    const whName = whById.get(bal.warehouseId)?.warehouseName ?? bal.warehouse?.name ?? 'Warehouse'
    const cur = warehouseMap.get(bal.warehouseId) ?? { name: whName, skuCount: 0, value: 0 }
    cur.skuCount += 1
    cur.value += value
    warehouseMap.set(bal.warehouseId, cur)

    const code = item?.code ?? bal.item?.code ?? '—'
    const name = item?.name ?? bal.item?.name ?? '—'
    if (onHand <= 0) {
      outOfStock += 1
      if (outOfStockItems.length < 8) {
        outOfStockItems.push({
          itemId: bal.itemId,
          itemCode: code,
          itemName: name,
          href: `/inventory/stock?search=${encodeURIComponent(code)}`,
        })
      }
    } else if (reorder > 0 && free <= reorder) {
      lowStock += 1
      if (lowStockItems.length < 8) {
        lowStockItems.push({
          itemId: bal.itemId,
          itemCode: code,
          itemName: name,
          onHand,
          reorderLevel: reorder,
          href: `/inventory/stock?search=${encodeURIComponent(code)}`,
        })
      }
    }
    if (hold > 0 && qualityHoldItems.length < 8) {
      qualityHoldItems.push({
        itemId: bal.itemId,
        itemCode: code,
        itemName: name,
        qty: hold,
        href: `/inventory/stock?search=${encodeURIComponent(code)}`,
      })
    }
  }

  const kpis = workbench?.data?.kpis
  const pendingIssue = kpis?.waitingIssue ?? 0
  const pendingReserve = kpis?.waitingReservation ?? 0
  const pendingFg = kpis?.waitingFg ?? 0
  const pendingReturns = kpis?.waitingReturns ?? 0

  const recentMovements = (ledgerRes.data ?? []).slice(0, 10).map((m) => ({
    id: m.id,
    movementNo: m.movementNumber,
    itemCode: m.item?.code ?? itemById.get(m.itemId)?.code ?? '—',
    type: m.referenceType,
    qty: num(m.quantity),
    date: m.movementDate,
    href: `/inventory/ledger?search=${encodeURIComponent(m.movementNumber)}`,
  }))

  return {
    kpis: [
      {
        id: 'total-value',
        label: 'Stock value',
        value: formatCurrency(totalValue),
        tone: 'primary',
        href: '/inventory/stock',
      },
      {
        id: 'available',
        label: 'Available qty',
        value: Math.round(availableQty),
        tone: 'success',
        href: '/inventory/stock',
      },
      {
        id: 'low-stock',
        label: 'Low stock',
        value: lowStock,
        tone: lowStock > 0 ? 'warning' : 'success',
        href: '/inventory/reports/low-stock',
      },
      {
        id: 'out-of-stock',
        label: 'Out of stock',
        value: outOfStock,
        tone: outOfStock > 0 ? 'danger' : 'success',
        href: '/inventory/reports/out-of-stock',
      },
      {
        id: 'quality-hold',
        label: 'Quality hold',
        value: Math.round(qualityHoldQty),
        tone: qualityHoldQty > 0 ? 'warning' : 'neutral',
        href: '/inventory/reports/quality-hold-stock',
      },
      {
        id: 'to-issue',
        label: 'Material to issue',
        value: pendingIssue,
        tone: pendingIssue > 0 ? 'primary' : 'neutral',
        href: '/inventory/store-workbench',
      },
      {
        id: 'to-reserve',
        label: 'Production requests',
        value: pendingReserve,
        tone: pendingReserve > 0 ? 'warning' : 'neutral',
        href: '/inventory/store-workbench',
      },
      {
        id: 'fg-pending',
        label: 'FG to receive',
        value: pendingFg,
        tone: pendingFg > 0 ? 'primary' : 'neutral',
        href: '/inventory/store-workbench',
      },
      {
        id: 'returns',
        label: 'Shop returns',
        value: pendingReturns,
        tone: pendingReturns > 0 ? 'primary' : 'neutral',
        href: '/inventory/store-workbench',
      },
    ],
    pendingActions: [
      {
        id: 'grn',
        label: 'Receive against purchase order (GRN)',
        count: 0,
        href: '/purchase/grn',
      },
      {
        id: 'issue-wo',
        label: 'Issue material to production',
        count: pendingIssue,
        href: '/inventory/store-workbench',
      },
      {
        id: 'reserve',
        label: 'Reserve material for work orders',
        count: pendingReserve,
        href: '/inventory/store-workbench',
      },
      {
        id: 'fg',
        label: 'Receive finished goods',
        count: pendingFg,
        href: '/inventory/store-workbench',
      },
      {
        id: 'transfers',
        label: 'Move stock between warehouses',
        count: 0,
        href: '/inventory/movements/transfers',
      },
      {
        id: 'count',
        label: 'Physical stock count',
        count: 0,
        href: '/inventory/stock-count',
      },
    ],
    lowStockItems,
    outOfStockItems,
    qualityHoldItems,
    recentMovements,
    warehouseStock: [...warehouseMap.entries()].map(([warehouseId, data]) => ({
      warehouseId,
      warehouseName: data.name,
      skuCount: data.skuCount,
      value: data.value,
      href: `/inventory/stock?warehouseId=${warehouseId}`,
    })),
    categoryValue: [],
  }
}
