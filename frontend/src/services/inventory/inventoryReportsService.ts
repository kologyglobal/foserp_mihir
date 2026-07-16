/**
 * Inventory Reports mock service (Phase 6).
 */

import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import type {
  InventoryExportOptions,
  InventoryPrintPreview,
  InventoryReportCategoryGroup,
  InventoryReportCatalogEntry,
  InventoryReportColumn,
  InventoryReportFilters,
  InventoryReportId,
  InventoryReportResult,
  InventoryReportRow,
} from '../../types/inventoryDomain'
import { getStockAvailability } from './inventoryService'
import { getInventoryPlanning as getPlanningRows } from './inventoryPlanningService'

const delay = (ms = 50) => new Promise<void>((r) => setTimeout(r, ms))

const CATALOG: InventoryReportCatalogEntry[] = [
  { id: 'stock-summary', title: 'Stock Summary', description: 'On-hand, available, reserved and projected stock by item.', categoryId: 'stock', categoryLabel: 'Stock Reports' },
  { id: 'warehouse-wise-stock', title: 'Warehouse-Wise Stock', description: 'Stock positions grouped by warehouse.', categoryId: 'stock', categoryLabel: 'Stock Reports' },
  { id: 'item-ledger', title: 'Item Ledger', description: 'Movement history for inventory items.', categoryId: 'stock', categoryLabel: 'Stock Reports' },
  { id: 'inventory-valuation', title: 'Inventory Valuation', description: 'Stock value by item and warehouse.', categoryId: 'stock', categoryLabel: 'Stock Reports', requiresCost: true },
  { id: 'receipt-register', title: 'Receipt Register', description: 'Material receipts and GRN postings.', categoryId: 'movement', categoryLabel: 'Movement Reports' },
  { id: 'issue-register', title: 'Issue Register', description: 'Material issues to production and other demand.', categoryId: 'movement', categoryLabel: 'Movement Reports' },
  { id: 'transfer-register', title: 'Transfer Register', description: 'Inter-warehouse stock transfers.', categoryId: 'movement', categoryLabel: 'Movement Reports' },
  { id: 'adjustment-register', title: 'Adjustment Register', description: 'Stock adjustment documents.', categoryId: 'movement', categoryLabel: 'Movement Reports' },
  { id: 'return-register', title: 'Return Register', description: 'Customer and vendor return movements.', categoryId: 'movement', categoryLabel: 'Movement Reports' },
  { id: 'batch-register', title: 'Batch Register', description: 'Batch-tracked stock positions.', categoryId: 'tracking', categoryLabel: 'Tracking Reports' },
  { id: 'serial-register', title: 'Serial Register', description: 'Serial-tracked stock positions.', categoryId: 'tracking', categoryLabel: 'Tracking Reports' },
  { id: 'quality-hold-stock', title: 'Quality-Hold Stock', description: 'Stock awaiting quality disposition.', categoryId: 'exception', categoryLabel: 'Exception Reports' },
  { id: 'blocked-stock', title: 'Blocked Stock', description: 'Blocked inventory positions.', categoryId: 'exception', categoryLabel: 'Exception Reports' },
  { id: 'low-stock', title: 'Low-Stock Report', description: 'Items at or below reorder level.', categoryId: 'exception', categoryLabel: 'Exception Reports' },
  { id: 'out-of-stock', title: 'Out-of-Stock Report', description: 'Zero on-hand positions.', categoryId: 'exception', categoryLabel: 'Exception Reports' },
  { id: 'negative-stock', title: 'Negative Stock Report', description: 'Available quantity below zero.', categoryId: 'exception', categoryLabel: 'Exception Reports', externalPath: '/reports/inventory/negative-stock' },
  { id: 'stock-ageing', title: 'Stock Ageing', description: 'Inventory aged by last movement.', categoryId: 'analysis', categoryLabel: 'Analysis Reports', externalPath: '/reports/inventory/stock-aging' },
  { id: 'slow-moving', title: 'Slow-Moving Stock', description: 'Items with no issue in 90+ days.', categoryId: 'analysis', categoryLabel: 'Analysis Reports', externalPath: '/reports/inventory/slow-moving' },
  { id: 'non-moving', title: 'Non-Moving Stock', description: 'Items with no movement in 180+ days.', categoryId: 'analysis', categoryLabel: 'Analysis Reports' },
  { id: 'expiry', title: 'Expiry Report', description: 'Batch stock nearing expiry.', categoryId: 'tracking', categoryLabel: 'Tracking Reports' },
  { id: 'physical-count-variance', title: 'Physical Count Variance', description: 'Stock count differences vs system.', categoryId: 'count', categoryLabel: 'Stock Count Reports' },
  { id: 'reorder-planning', title: 'Reorder Planning Report', description: 'Replenishment suggestions from planning.', categoryId: 'planning', categoryLabel: 'Planning Reports' },
]

const CATEGORY_META = [
  { id: 'stock', label: 'Stock Reports', description: 'Summary, ledger, and valuation.' },
  { id: 'movement', label: 'Movement Reports', description: 'Receipts, issues, transfers, adjustments, returns.' },
  { id: 'tracking', label: 'Tracking Reports', description: 'Batch, serial, and expiry tracking.' },
  { id: 'exception', label: 'Exception Reports', description: 'Low stock, quality hold, blocked, negative.' },
  { id: 'analysis', label: 'Analysis Reports', description: 'Ageing and slow/non-moving analysis.' },
  { id: 'count', label: 'Stock Count Reports', description: 'Physical count variances.' },
  { id: 'planning', label: 'Planning Reports', description: 'Reorder and replenishment suggestions.' },
]

export function isInventoryReportId(id: string): id is InventoryReportId {
  return CATALOG.some((r) => r.id === id)
}

export function getInventoryReportEntry(id: InventoryReportId): InventoryReportCatalogEntry | undefined {
  return CATALOG.find((r) => r.id === id)
}

export async function getInventoryReports(): Promise<InventoryReportCategoryGroup[]> {
  await delay()
  return CATEGORY_META.map((cat) => ({
    id: cat.id,
    label: cat.label,
    description: cat.description,
    reports: CATALOG.filter((r) => r.categoryId === cat.id),
  }))
}

function inDateRange(iso: string, filters: InventoryReportFilters): boolean {
  if (filters.dateFrom && iso < filters.dateFrom) return false
  if (filters.dateTo && iso > filters.dateTo) return false
  return true
}

function matchesSearch(row: InventoryReportRow, search: string, keys: string[]): boolean {
  if (!search) return true
  const q = search.toLowerCase()
  return keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
}

export async function runInventoryReport(
  reportId: InventoryReportId,
  filters: InventoryReportFilters,
  canViewCost: boolean,
): Promise<InventoryReportResult> {
  await delay()
  const entry = getInventoryReportEntry(reportId)
  const generatedAt = new Date().toISOString()
  const hideCost = Boolean(entry?.requiresCost && !canViewCost)

  const stock = await getStockAvailability({
    search: filters.search || undefined,
    warehouseId: filters.warehouseId || undefined,
    itemType: filters.itemType && filters.itemType !== 'all' ? filters.itemType as never : undefined,
    lowStock: reportId === 'low-stock' ? true : undefined,
    outOfStock: reportId === 'out-of-stock' ? true : undefined,
    negativeStock: reportId === 'negative-stock' ? true : undefined,
  })

  const master = useMasterStore.getState()
  const inv = useInventoryStore.getState()
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
        { key: 'expectedReceipt', label: 'Expected Receipt', format: 'number', align: 'right' },
        { key: 'plannedIssue', label: 'Planned Issue', format: 'number', align: 'right' },
      ]
      rows = stock.map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        available: s.available,
        reserved: s.reserved,
        expectedReceipt: s.expectedReceipt,
        plannedIssue: s.plannedIssue,
      }))
      break

    case 'warehouse-wise-stock':
      columns = [
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'skuCount', label: 'SKUs', format: 'number', align: 'right' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        ...(hideCost ? [] : [{ key: 'value', label: 'Value', format: 'currency' as const, align: 'right' as const }]),
      ]
      {
        const map = new Map<string, { warehouseName: string; skuCount: number; onHand: number; value: number }>()
        for (const s of stock) {
          const cur = map.get(s.warehouseId) ?? { warehouseName: s.warehouseName, skuCount: 0, onHand: 0, value: 0 }
          cur.skuCount++
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
      }
      break

    case 'inventory-valuation':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        ...(hideCost ? [] : [{ key: 'stockValue', label: 'Stock Value', format: 'currency' as const, align: 'right' as const }]),
      ]
      rows = stock.map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        stockValue: hideCost ? null : s.stockValue,
      }))
      break

    case 'item-ledger':
      columns = [
        { key: 'movementNo', label: 'Document' },
        { key: 'itemCode', label: 'Item' },
        { key: 'type', label: 'Type' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'warehouseName', label: 'Warehouse' },
      ]
      rows = inv.getMovements()
        .filter((m) => inDateRange(m.movementDate, filters))
        .filter((m) => !filters.itemId || m.itemId === filters.itemId)
        .filter((m) => !filters.warehouseId || m.warehouseId === filters.warehouseId)
        .map((m) => ({
          movementNo: m.movementNo,
          itemCode: master.getItem(m.itemId)?.itemCode ?? '—',
          type: m.referenceType,
          qty: m.qty,
          date: m.movementDate,
          warehouseName: master.getWarehouse(m.warehouseId)?.warehouseName ?? '—',
        }))
      break

    case 'receipt-register':
    case 'issue-register':
    case 'transfer-register':
    case 'adjustment-register':
    case 'return-register':
      columns = [
        { key: 'movementNo', label: 'Document' },
        { key: 'type', label: 'Type' },
        { key: 'itemCode', label: 'Item' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'warehouseName', label: 'Warehouse' },
      ]
      rows = inv.getMovements()
        .filter((m) => inDateRange(m.movementDate, filters))
        .filter((m) => {
          const t = m.referenceType.toLowerCase()
          if (reportId === 'receipt-register') return t.includes('receipt') || t.includes('grn') || t.includes('inward')
          if (reportId === 'issue-register') return t.includes('issue')
          if (reportId === 'transfer-register') return t.includes('transfer')
          if (reportId === 'adjustment-register') return t.includes('adjust')
          if (reportId === 'return-register') return t.includes('return')
          return true
        })
        .map((m) => ({
          movementNo: m.movementNo,
          type: m.referenceType,
          itemCode: master.getItem(m.itemId)?.itemCode ?? '—',
          qty: m.qty,
          date: m.movementDate,
          warehouseName: master.getWarehouse(m.warehouseId)?.warehouseName ?? '—',
        }))
      break

    case 'quality-hold-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
      ]
      rows = stock.filter((s) => s.qualityHold > 0).map((s) => ({
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
      rows = stock.filter((s) => s.blocked > 0).map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        qty: s.blocked,
      }))
      break

    case 'low-stock':
    case 'out-of-stock':
    case 'negative-stock':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'available', label: 'Available', format: 'number', align: 'right' },
        { key: 'reorderLevel', label: 'Reorder Level', format: 'number', align: 'right' },
      ]
      rows = stock.map((s) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        available: s.available,
        reorderLevel: s.reorderLevel,
      }))
      break

    case 'batch-register':
    case 'serial-register':
    case 'expiry':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'batchNo', label: reportId === 'serial-register' ? 'Serial No' : 'Batch No' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'qty', label: 'Qty', format: 'number', align: 'right' },
        ...(reportId === 'expiry' ? [{ key: 'expiryDate', label: 'Expiry', format: 'date' as const }] : []),
      ]
      rows = stock.slice(0, 20).map((s, idx) => ({
        itemCode: s.itemCode,
        batchNo: reportId === 'serial-register' ? `SN-${s.itemCode}-${idx + 1}` : `B-${s.itemCode}-${String(idx + 1).padStart(3, '0')}`,
        warehouseName: s.warehouseName,
        qty: s.onHand,
        expiryDate: reportId === 'expiry' ? '2026-08-15' : null,
      }))
      break

    case 'slow-moving':
    case 'non-moving':
    case 'stock-ageing':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'itemName', label: 'Item Name' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'onHand', label: 'On Hand', format: 'number', align: 'right' },
        { key: 'daysSinceMovement', label: 'Days Since Movement', format: 'number', align: 'right' },
      ]
      rows = stock.slice(0, 30).map((s, idx) => ({
        itemCode: s.itemCode,
        itemName: s.itemName,
        warehouseName: s.warehouseName,
        onHand: s.onHand,
        daysSinceMovement: reportId === 'non-moving' ? 180 + idx * 3 : reportId === 'slow-moving' ? 95 + idx : 45 + idx * 2,
      }))
      break

    case 'physical-count-variance':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'systemQty', label: 'System Qty', format: 'number', align: 'right' },
        { key: 'countedQty', label: 'Counted Qty', format: 'number', align: 'right' },
        { key: 'variance', label: 'Variance', format: 'number', align: 'right' },
      ]
      rows = stock.slice(0, 12).map((s, idx) => ({
        itemCode: s.itemCode,
        warehouseName: s.warehouseName,
        systemQty: s.onHand,
        countedQty: s.onHand - (idx % 3 === 0 ? 2 : 0),
        variance: idx % 3 === 0 ? -2 : 0,
      }))
      break

    case 'reorder-planning':
      columns = [
        { key: 'itemCode', label: 'Item Code' },
        { key: 'warehouseName', label: 'Warehouse' },
        { key: 'projectedStock', label: 'Projected Stock', format: 'number', align: 'right' },
        { key: 'suggestedQuantity', label: 'Suggested Qty', format: 'number', align: 'right' },
        { key: 'suggestedSource', label: 'Source' },
        { key: 'requiredDate', label: 'Required Date', format: 'date' },
      ]
      {
        const planning = await getPlanningRows({ includeIgnored: false })
        rows = planning.map((p) => ({
          itemCode: p.itemCode,
          warehouseName: p.warehouseName,
          projectedStock: p.projectedStock,
          suggestedQuantity: p.suggestedQuantity,
          suggestedSource: p.suggestedSource,
          requiredDate: p.requiredDate,
        }))
      }
      break

    default:
      columns = [{ key: 'message', label: 'Message' }]
      rows = [{ message: 'Report data not available in demo.' }]
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

export async function exportInventoryData(options: InventoryExportOptions): Promise<Blob> {
  await delay()
  const result = await runInventoryReport(options.reportId, options.filters, true)
  const header = result.columns.map((c) => c.label).join(',')
  const body = result.rows.map((row) =>
    result.columns.map((c) => {
      const v = row[c.key]
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') ? `"${s}"` : s
    }).join(','),
  )
  const content = [header, ...body].join('\n')
  const type = options.format === 'pdf' ? 'application/pdf' : options.format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv;charset=utf-8'
  return new Blob([content], { type })
}

export async function getInventoryPrintPreview(
  reportId: InventoryReportId,
  filters: InventoryReportFilters,
  canViewCost: boolean,
): Promise<InventoryPrintPreview> {
  await delay()
  const result = await runInventoryReport(reportId, filters, canViewCost)
  const html = `
    <html><head><title>${result.title}</title></head><body>
    <h1>${result.title}</h1>
    <p>${result.description}</p>
    <p>Generated: ${result.generatedAt}</p>
    <table border="1" cellpadding="4"><thead><tr>
    ${result.columns.map((c) => `<th>${c.label}</th>`).join('')}
    </tr></thead><tbody>
    ${result.rows.map((row) => `<tr>${result.columns.map((c) => `<td>${row[c.key] ?? '—'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></body></html>`
  return { title: result.title, html, generatedAt: result.generatedAt }
}

export function getInventoryReportFilterOptions() {
  const master = useMasterStore.getState()
  return {
    warehouses: master.warehouses.filter((w) => w.isActive).map((w) => ({ id: w.id, label: w.warehouseName })),
    categories: master.categories.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.categoryName })),
    plants: [...new Set(master.warehouses.map((w) => w.plantCode).filter(Boolean))],
    movementTypes: ['receipt', 'issue', 'transfer', 'adjustment', 'return'],
    sourceModules: ['purchase', 'production', 'sales', 'quality', 'manual'],
    statuses: ['draft', 'posted', 'pending', 'quality_hold', 'blocked'],
  }
}
