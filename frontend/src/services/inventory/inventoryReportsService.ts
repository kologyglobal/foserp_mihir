/**
 * Inventory Reports service — live API composition.
 */

import type {
  InventoryExportOptions,
  InventoryPrintPreview,
  InventoryReportCategoryGroup,
  InventoryReportCatalogEntry,
  InventoryReportFilters,
  InventoryReportId,
  InventoryReportResult,
} from '../../types/inventoryDomain'

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
  // Analysis reports live inside the inventory runner (live balances), not an external report pack.
  const catalog = CATALOG.map((r) => (r.externalPath ? { ...r, externalPath: undefined } : r))
  return CATEGORY_META.map((cat) => ({
    id: cat.id,
    label: cat.label,
    description: cat.description,
    reports: catalog.filter((r) => r.categoryId === cat.id),
  }))
}

export async function runInventoryReport(
  reportId: InventoryReportId,
  filters: InventoryReportFilters,
  canViewCost: boolean,
): Promise<InventoryReportResult> {
  const { runLiveInventoryReport } = await import('./inventoryReportsLive')
  return runLiveInventoryReport(reportId, filters, canViewCost)
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
    ${result.rows.map((row) => `<tr>${result.columns.map((c) => `<td>${row[c.key] ?? '-'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></body></html>`
  return { title: result.title, html, generatedAt: result.generatedAt }
}

export function getInventoryReportFilterOptions() {
  // Sync stub — callers should prefer getInventoryReportFilterOptionsAsync for live data.
  return {
    warehouses: [] as Array<{ id: string; label: string }>,
    categories: [] as Array<{ id: string; label: string }>,
    plants: [] as string[],
    movementTypes: ['receipt', 'issue', 'transfer', 'adjustment', 'return'],
    sourceModules: ['purchase', 'production', 'sales', 'quality', 'manual'],
    statuses: ['draft', 'posted', 'pending', 'quality_hold', 'blocked'],
  }
}

export async function getInventoryReportFilterOptionsAsync() {
  const { getLiveInventoryReportFilterOptions } = await import('./inventoryReportsLive')
  return getLiveInventoryReportFilterOptions()
}
