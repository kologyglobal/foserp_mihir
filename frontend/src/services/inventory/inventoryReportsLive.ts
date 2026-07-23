/**
 * Live inventory reports — compose balances / ledger / lots / documents / planning.
 * No dedicated reports microservice; same pattern as inventoryPlanningLive.
 */
import { fetchItems, type ItemDto } from '../api/masterBatchApi'
import { fetchMasterWarehouses, mapWarehouseDto } from '../api/masterApi'
import {
  listInventoryBalances,
  listInventoryLedger,
  listInventoryLots,
  listInventorySerials,
  type InventoryStockBalance,
  type InventoryStockMovement,
} from '../api/inventoryApi'
import {
  listInventoryAdjustments,
  listInventoryStockCounts,
  listInventoryTransfers,
} from '../api/inventoryDocumentsApi'
import { listLiveInventoryPlanning } from './inventoryPlanningLive'
import type {
  InventoryReportColumn,
  InventoryReportFilters,
  InventoryReportId,
  InventoryReportResult,
  InventoryReportRow,
} from '../../types/inventoryDomain'
import { getInventoryReportEntry } from './inventoryReportsService'

function num(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 9999
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 9999
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function inDateRange(iso: string, filters: InventoryReportFilters): boolean {
  const day = iso.slice(0, 10)
  if (filters.dateFrom && day < filters.dateFrom) return false
  if (filters.dateTo && day > filters.dateTo) return false
  return true
}

function matchesSearch(row: InventoryReportRow, search: string, keys: string[]): boolean {
  if (!search) return true
  const q = search.toLowerCase()
  return keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
}

async function listAllBalances(warehouseId?: string): Promise<InventoryStockBalance[]> {
  const all: InventoryStockBalance[] = []
  let page = 1
  for (;;) {
    const res = await listInventoryBalances({ page, limit: 200, warehouseId: warehouseId || undefined })
    all.push(...(res.data ?? []))
    const meta = res.meta as { totalPages?: number } | undefined
    if (!meta?.totalPages || page >= meta.totalPages) break
    page += 1
    if (page > 50) break
  }
  return all
}

async function listAllLedger(filters: InventoryReportFilters): Promise<InventoryStockMovement[]> {
  const all: InventoryStockMovement[] = []
  let page = 1
  for (;;) {
    const res = await listInventoryLedger({
      page,
      limit: 200,
      warehouseId: filters.warehouseId || undefined,
      itemId: filters.itemId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    })
    all.push(...(res.data ?? []))
    const meta = res.meta as { totalPages?: number } | undefined
    if (!meta?.totalPages || page >= meta.totalPages) break
    page += 1
    if (page > 50) break
  }
  return all
}

function enrichBalance(
  bal: InventoryStockBalance,
  itemById: Map<string, ItemDto>,
  whById: Map<string, { id: string; warehouseName: string }>,
) {
  const item = itemById.get(bal.itemId)
  const wh = whById.get(bal.warehouseId)
  return {
    itemId: bal.itemId,
    warehouseId: bal.warehouseId,
    itemCode: item?.code ?? bal.item?.code ?? '—',
    itemName: item?.name ?? bal.item?.name ?? '—',
    warehouseName: wh?.warehouseName ?? bal.warehouse?.name ?? '—',
    onHand: num(bal.onHandQty),
    available: num(bal.freeQty),
    reserved: num(bal.reservedQty),
    qualityHold: num(bal.qcHoldQty),
    blocked: num(bal.blockedQty),
    stockValue: num(bal.stockValue),
    avgRate: num(bal.avgRate),
    reorderLevel: num(item?.reorderLevel),
    updatedAt: bal.updatedAt ?? null,
  }
}

export async function runLiveInventoryReport(
  reportId: InventoryReportId,
  filters: InventoryReportFilters,
  canViewCost: boolean,
): Promise<InventoryReportResult> {
  const entry = getInventoryReportEntry(reportId)
  const generatedAt = new Date().toISOString()
  const hideCost = Boolean(entry?.requiresCost && !canViewCost)

  const [items, warehouses, balances] = await Promise.all([
    fetchItems().catch(() => [] as ItemDto[]),
    fetchMasterWarehouses().catch(() => [] as Awaited<ReturnType<typeof fetchMasterWarehouses>>),
    listAllBalances(filters.warehouseId || undefined).catch(() => [] as InventoryStockBalance[]),
  ])

  const itemById = new Map(items.map((i) => [i.id, i]))
  const whById = new Map(
    warehouses.map((row) => {
      const w = mapWarehouseDto(row)
      return [w.id, w] as const
    }),
  )

  let stock = balances.map((b) => enrichBalance(b, itemById, whById))
  if (filters.search) {
    const q = filters.search.toLowerCase()
    stock = stock.filter((s) => `${s.itemCode} ${s.itemName}`.toLowerCase().includes(q))
  }
  if (filters.itemId) stock = stock.filter((s) => s.itemId === filters.itemId)

  let columns: InventoryReportColumn[] = []
  let rows: InventoryReportRow[] = []

  switch (reportId) {
    case 'stock-summary':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'available', label: 'Available', format: 'number', align: 'right' },
        { key: 'reserved', label: 'Reserved', format: 'number', align: 'right' },
        { key: 'qualityHold', label: 'QC Hold', format: 'number', align: 'right' },
      ]
      rows = stock.map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        available: s.available,
        reserved: s.reserved,
        qualityHold: s.qualityHold,
      }))
      break

    case 'warehouse-wise-stock': {
      columns = [
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'skuCount', label: 'SKUs', format: 'number', align: 'right' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        ...(hideCost ? [] : [{ key: 'value', label: 'Value', format: 'currency' as const, align: 'right' as const }]),
      ]
      const map = new Map<string, { warehouseName: string; skuCount: number; onHand: number; value: number }>()
      for (const s of stock) {
        const cur = map.get(s.warehouseId) ?? { warehouseName: s.warehouseName, skuCount: 0, onHand: 0, value: 0 }
        cur.skuCount += 1
        cur.onHand += s.onHand
        cur.value += s.stockValue
        map.set(s.warehouseId, cur)
      }
      rows = [...map.values()].map((w) => ({
        warehouseName: w.warehouseName,
        skuCount: w.skuCount,
        onHand: w.onHand,
        value: hideCost ? null : w.value,
      }))
      break
    }

    case 'inventory-valuation':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        ...(hideCost
          ? []
          : [
              { key: 'avgRate', label: 'Avg Rate', format: 'currency' as const, align: 'right' as const },
              { key: 'stockValue', label: 'Stock Value', format: 'currency' as const, align: 'right' as const },
            ]),
      ]
      rows = stock.map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        avgRate: hideCost ? null : s.avgRate,
        stockValue: hideCost ? null : s.stockValue,
      }))
      break

    case 'item-ledger':
    case 'receipt-register':
    case 'issue-register':
    case 'return-register': {
      const ledger = await listAllLedger(filters)
      columns = [
        { key: 'movementNo', label: 'Document' },
        { key: 'type', label: 'Type' },
        { key: 'itemCode', label: 'Item' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'warehouseName', label: 'Warehouse' },
      ]
      rows = ledger
        .filter((m) => inDateRange(m.movementDate, filters))
        .filter((m) => {
          const ref = `${m.movementType}:${m.referenceType}`.toUpperCase()
          if (reportId === 'receipt-register') {
            return (
              m.movementType === 'INWARD' ||
              m.movementType === 'OPENING' ||
              ref.includes('GRN') ||
              ref.includes('RECEIPT') ||
              ref.includes('INWARD')
            )
          }
          if (reportId === 'issue-register') {
            return m.movementType === 'ISSUE' || ref.includes('ISSUE') || ref.includes('DISPATCH')
          }
          if (reportId === 'return-register') return ref.includes('RETURN')
          return true
        })
        .map((m) => ({
          movementNo: m.movementNumber,
          type: m.referenceType,
          itemCode: m.item?.code ?? itemById.get(m.itemId)?.code ?? '—',
          qty: num(m.quantity),
          date: m.movementDate,
          warehouseName: m.warehouse?.name ?? whById.get(m.warehouseId)?.warehouseName ?? '—',
        }))
      break
    }

    case 'transfer-register': {
      const transfers = (await listInventoryTransfers({ limit: 200 })).data ?? []
      columns = [
        { key: 'movementNo', label: 'Document' },
        { key: 'type', label: 'Status' },
        { key: 'itemCode', label: 'From → To' },
        { key: 'qty', label: 'Lines', format: 'number', align: 'right' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'warehouseName', label: 'Warehouses' },
      ]
      rows = transfers
        .filter((t) => inDateRange(t.transferDate ?? t.createdAt, filters))
        .map((t) => ({
          movementNo: t.transferNumber ?? t.id,
          type: t.status,
          itemCode: `${whById.get(t.fromWarehouseId ?? '')?.warehouseName ?? '—'} → ${whById.get(t.toWarehouseId ?? '')?.warehouseName ?? '—'}`,
          qty: t.lines?.length ?? 0,
          date: t.transferDate ?? t.createdAt,
          warehouseName: whById.get(t.fromWarehouseId ?? '')?.warehouseName ?? '—',
        }))
      break
    }

    case 'adjustment-register': {
      const adjustments = (await listInventoryAdjustments({ limit: 200 })).data ?? []
      columns = [
        { key: 'movementNo', label: 'Document' },
        { key: 'type', label: 'Status' },
        { key: 'itemCode', label: 'Reason' },
        { key: 'qty', label: 'Lines', format: 'number', align: 'right' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'warehouseName', label: 'Warehouse' },
      ]
      rows = adjustments
        .filter((a) => inDateRange(a.adjustmentDate ?? a.createdAt, filters))
        .filter((a) => !filters.warehouseId || a.warehouseId === filters.warehouseId)
        .map((a) => ({
          movementNo: a.adjustmentNumber ?? a.id,
          type: a.status,
          itemCode: a.reason ?? '—',
          qty: a.lines?.length ?? 0,
          date: a.adjustmentDate ?? a.createdAt,
          warehouseName: whById.get(a.warehouseId ?? '')?.warehouseName ?? '—',
        }))
      break
    }

    case 'quality-hold-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
      ]
      rows = stock
        .filter((s) => s.qualityHold > 0)
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          qty: s.qualityHold,
        }))
      break

    case 'blocked-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
      ]
      rows = stock
        .filter((s) => s.blocked > 0)
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          qty: s.blocked,
        }))
      break

    case 'low-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'available', label: 'Available', format: 'number', align: 'right' },
        { key: 'reorderLevel', label: 'Reorder Level', format: 'number', align: 'right' },
      ]
      rows = stock
        .filter((s) => s.reorderLevel > 0 && s.available <= s.reorderLevel)
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          onHand: s.onHand,
          available: s.available,
          reorderLevel: s.reorderLevel,
        }))
      break

    case 'out-of-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'available', label: 'Available', format: 'number', align: 'right' },
        { key: 'reorderLevel', label: 'Reorder Level', format: 'number', align: 'right' },
      ]
      rows = stock
        .filter((s) => s.onHand <= 0)
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          onHand: s.onHand,
          available: s.available,
          reorderLevel: s.reorderLevel,
        }))
      break

    case 'negative-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'available', label: 'Available', format: 'number', align: 'right' },
        { key: 'reorderLevel', label: 'Reorder Level', format: 'number', align: 'right' },
      ]
      rows = stock
        .filter((s) => s.available < 0 || s.onHand < 0)
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          onHand: s.onHand,
          available: s.available,
          reorderLevel: s.reorderLevel,
        }))
      break

    case 'batch-register':
    case 'expiry': {
      const lots = (await listInventoryLots({ limit: 200, warehouseId: filters.warehouseId || undefined })).data ?? []
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'batchNo', label: 'Batch No' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        ...(reportId === 'expiry' ? [{ key: 'expiryDate', label: 'Expiry', format: 'date' as const }] : []),
        { key: 'status', label: 'Status' },
      ]
      rows = lots
        .filter((l) => reportId !== 'expiry' || Boolean(l.expiryDate))
        .map((l) => ({
          itemCode: itemById.get(l.itemId)?.code ?? '—',
          batchNo: l.lotNumber,
          warehouseName: whById.get(l.warehouseId ?? '')?.warehouseName ?? '—',
          qty: num(l.quantityOnHand),
          expiryDate: l.expiryDate,
          status: l.status,
        }))
      break
    }

    case 'serial-register': {
      const serials = (await listInventorySerials({ limit: 200, warehouseId: filters.warehouseId || undefined })).data ?? []
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'batchNo', label: 'Serial No' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        { key: 'status', label: 'Status' },
      ]
      rows = serials.map((s) => ({
        itemCode: itemById.get(s.itemId)?.code ?? '—',
        batchNo: s.serialNumber,
        warehouseName: whById.get(s.warehouseId ?? '')?.warehouseName ?? '—',
        qty: 1,
        status: s.status,
      }))
      break
    }

    case 'slow-moving':
    case 'non-moving':
    case 'stock-ageing': {
      const threshold = reportId === 'non-moving' ? 180 : reportId === 'slow-moving' ? 90 : 0
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'daysSinceMovement', label: 'Days Since Update', format: 'number', align: 'right' },
      ]
      rows = stock
        .map((s) => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          warehouseName: s.warehouseName,
          onHand: s.onHand,
          daysSinceMovement: daysSince(s.updatedAt),
        }))
        .filter((r) => r.onHand > 0 && (threshold === 0 || r.daysSinceMovement >= threshold))
      break
    }

    case 'physical-count-variance': {
      const counts = (await listInventoryStockCounts({ limit: 100 })).data ?? []
      columns = [
        { key: 'itemCode', label: 'Count No' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'systemQty', label: 'Lines', format: 'number', align: 'right' },
        { key: 'countedQty', label: 'Variance Lines', format: 'number', align: 'right' },
        { key: 'variance', label: 'Net Variance', format: 'number', align: 'right' },
      ]
      rows = counts.map((c) => {
        const lines = c.lines ?? []
        const varianceLines = lines.filter((l) => num(l.varianceQty) !== 0)
        const net = varianceLines.reduce((sum, l) => sum + num(l.varianceQty), 0)
        return {
          itemCode: c.countNumber ?? c.id,
          warehouseName: whById.get(c.warehouseId ?? '')?.warehouseName ?? '—',
          systemQty: lines.length,
          countedQty: varianceLines.length,
          variance: net,
        }
      })
      break
    }

    case 'reorder-planning': {
      const planning = await listLiveInventoryPlanning({
        warehouseId: filters.warehouseId || undefined,
        search: filters.search || undefined,
        includeIgnored: false,
      })
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'projectedStock', label: 'Projected Stock', format: 'number', align: 'right' },
        { key: 'suggestedQuantity', label: 'Suggested Qty', format: 'number', align: 'right' },
        { key: 'suggestedSource', label: 'Source' },
        { key: 'requiredDate', label: 'Required Date', format: 'date' },
      ]
      rows = planning.map((p) => ({
        itemCode: p.itemCode,
        warehouseName: p.warehouseName,
        projectedStock: p.projectedStock,
        suggestedQuantity: p.suggestedQuantity,
        suggestedSource: p.suggestedSource,
        requiredDate: p.requiredDate,
      }))
      break
    }

    default:
      columns = [{ key: 'message', label: 'Message' }]
      rows = [{ message: `Report "${reportId}" is not available on the live inventory API yet.` }]
  }

  if (filters.search) {
    const keys = columns.map((c) => c.key)
    rows = rows.filter((r) => matchesSearch(r, filters.search, keys))
  }

  return {
    reportId,
    title: entry?.title ?? reportId,
    description: entry?.description ?? '',
    generatedAt,
    columns,
    rows,
    summary: [{ label: 'Rows', value: rows.length }],
    hideCost,
  }
}

export async function getLiveInventoryReportFilterOptions() {
  const warehouses = await fetchMasterWarehouses().catch(() => [])
  return {
    warehouses: warehouses
      .map(mapWarehouseDto)
      .filter((w) => w.isActive)
      .map((w) => ({ id: w.id, label: w.warehouseName })),
    categories: [] as Array<{ id: string; label: string }>,
    plants: [...new Set(warehouses.map((w) => mapWarehouseDto(w).plantCode).filter(Boolean))],
    movementTypes: ['receipt', 'issue', 'transfer', 'adjustment', 'return'],
    sourceModules: ['purchase', 'production', 'sales', 'quality', 'manual'],
    statuses: ['draft', 'posted', 'pending', 'quality_hold', 'blocked'],
  }
}
