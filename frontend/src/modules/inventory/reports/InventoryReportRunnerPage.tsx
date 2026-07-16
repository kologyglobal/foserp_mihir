import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileDown, FileSpreadsheet, Printer, RefreshCw, RotateCcw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  exportInventoryData,
  getInventoryPrintPreview,
  getInventoryReportEntry,
  getInventoryReportFilterOptions,
  isInventoryReportId,
  runInventoryReport,
} from '@/services/inventory'
import type { InventoryReportFilters, InventoryReportResult } from '@/types/inventoryDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useInventoryPermissions } from '@/utils/permissions/inventory'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function financialYearStart(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const fyStartYear = month >= 4 ? year : year - 1
  return `${fyStartYear}-04-01`
}

const DEFAULT_FILTERS: InventoryReportFilters = {
  dateFrom: financialYearStart(),
  dateTo: new Date().toISOString().slice(0, 10),
  itemId: '',
  categoryId: '',
  itemType: '',
  warehouseId: '',
  plantCode: '',
  batchNo: '',
  status: '',
  movementType: '',
  sourceModule: '',
  search: '',
}

function formatCell(value: string | number | null | undefined, format?: string): string {
  if (value == null || value === '') return '—'
  if (format === 'currency') return formatCurrency(Number(value))
  if (format === 'date' && typeof value === 'string') return formatDate(value)
  return String(value)
}

export function InventoryReportRunnerPage() {
  const { reportId: reportIdParam } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const reportId = reportIdParam && isInventoryReportId(reportIdParam) ? reportIdParam : null
  const entry = reportId ? getInventoryReportEntry(reportId) : undefined

  const [filters, setFilters] = useState<InventoryReportFilters>(DEFAULT_FILTERS)
  const [result, setResult] = useState<InventoryReportResult | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const filterOptions = useMemo(() => getInventoryReportFilterOptions(), [])

  const load = useCallback(async () => {
    if (!reportId) return
    setLoadState('loading')
    try {
      const data = await runInventoryReport(reportId, filters, perms.canViewCost)
      setResult(data)
      setLoadState(data.rows.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [reportId, filters, perms.canViewCost])

  useEffect(() => { void load() }, [load])

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    if (!reportId) return
    const blob = await exportInventoryData({ format, reportId, filters })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportId}-report.${format === 'pdf' ? 'pdf' : format === 'xlsx' ? 'xlsx' : 'csv'}`
    a.click()
    URL.revokeObjectURL(url)
    notify.success(`Exported as ${format.toUpperCase()} (demo)`)
  }

  async function handlePrint() {
    if (!reportId) return
    const preview = await getInventoryPrintPreview(reportId, filters, perms.canViewCost)
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(preview.html)
      w.document.close()
      w.print()
    }
  }

  if (!perms.canViewReports) {
    return <OperationalPageShell title="Access denied"><p className="text-sm text-erp-muted">inventory.reports.view required.</p></OperationalPageShell>
  }

  if (!reportId || !entry) {
    return (
      <OperationalPageShell title="Report not found" breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Reports', to: '/inventory/reports' }]}>
        <Link to="/inventory/reports" className="text-erp-primary underline">Back to reports</Link>
      </OperationalPageShell>
    )
  }

  if (entry.requiresCost && !perms.canViewCost) {
    return (
      <OperationalPageShell title={entry.title} description="Cost report — permission required.">
        <p className="text-sm text-erp-muted">inventory.view_cost permission is required to view this report.</p>
        <Link to="/inventory/reports" className="mt-3 inline-block text-erp-primary underline">Back to reports</Link>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title={entry.title}
      description={entry.description}
      breadcrumbs={[
        { label: 'Inventory & Warehouse', to: '/inventory' },
        { label: 'Reports', to: '/inventory/reports' },
        { label: entry.title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={`/inventory/reports/${reportId}`}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'back', label: 'All Reports', icon: ArrowLeft, onClick: () => navigate('/inventory/reports') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            { id: 'csv', label: 'Export CSV', icon: Download, onClick: () => void handleExport('csv') },
            { id: 'xlsx', label: 'Export Excel', icon: FileDown, onClick: () => void handleExport('xlsx') },
            { id: 'pdf', label: 'Export PDF', icon: FileDown, onClick: () => void handleExport('pdf') },
            { id: 'print', label: 'Print', icon: Printer, onClick: () => void handlePrint() },
          ]}
        />
      )}
    >
      <div className="mb-4 grid gap-2 rounded border border-erp-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Date From" id="rpt-from">
          <input id="rpt-from" type="date" className="erp-input h-9 w-full text-[12px]" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
        </FilterField>
        <FilterField label="Date To" id="rpt-to">
          <input id="rpt-to" type="date" className="erp-input h-9 w-full text-[12px]" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
        </FilterField>
        <FilterField label="Warehouse" id="rpt-wh">
          <select id="rpt-wh" className="erp-input h-9 w-full text-[12px]" value={filters.warehouseId} onChange={(e) => setFilters((f) => ({ ...f, warehouseId: e.target.value }))}>
            <option value="">All</option>
            {filterOptions.warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Category" id="rpt-cat">
          <select id="rpt-cat" className="erp-input h-9 w-full text-[12px]" value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">All</option>
            {filterOptions.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Plant" id="rpt-plant">
          <select id="rpt-plant" className="erp-input h-9 w-full text-[12px]" value={filters.plantCode} onChange={(e) => setFilters((f) => ({ ...f, plantCode: e.target.value }))}>
            <option value="">All</option>
            {filterOptions.plants.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </FilterField>
        <FilterField label="Movement Type" id="rpt-mv">
          <select id="rpt-mv" className="erp-input h-9 w-full text-[12px]" value={filters.movementType} onChange={(e) => setFilters((f) => ({ ...f, movementType: e.target.value }))}>
            <option value="">All</option>
            {filterOptions.movementTypes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </FilterField>
        <FilterField label="Source Module" id="rpt-src">
          <select id="rpt-src" className="erp-input h-9 w-full text-[12px]" value={filters.sourceModule} onChange={(e) => setFilters((f) => ({ ...f, sourceModule: e.target.value }))}>
            <option value="">All</option>
            {filterOptions.sourceModules.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FilterField>
        <FilterField label="Search" id="rpt-search">
          <SearchInput value={filters.search} onChange={(v) => setFilters((f) => ({ ...f, search: v }))} placeholder="Search report…" />
        </FilterField>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="button" className="erp-btn erp-btn-secondary inline-flex h-9 items-center gap-2 px-3 text-[13px]" onClick={() => setFilters(DEFAULT_FILTERS)}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset Filters
          </button>
          <button type="button" className="erp-btn erp-btn-primary ml-2 inline-flex h-9 items-center px-4 text-[13px]" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </div>

      {result?.hideCost ? (
        <p className="mb-3 text-[12px] text-amber-700" role="status">Cost columns hidden — inventory.view_cost not granted.</p>
      ) : null}

      {loadState === 'loading' ? <LoadingState variant="table" /> : null}
      {loadState === 'error' ? <p className="text-sm text-red-600" role="alert">Failed to run report.</p> : null}
      {loadState === 'empty' ? <EmptyState icon={FileSpreadsheet} title="No data" description="No rows match the current filters." /> : null}

      {loadState === 'ready' && result ? (
        <div className="overflow-x-auto">
          <EnterpriseRegisterTableShell>
            <table className="erp-table w-full min-w-[640px]">
              <thead>
                <tr>
                  {result.columns.map((c) => (
                    <th key={c.key} scope="col" className={c.align === 'right' ? 'text-right' : undefined}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, idx) => (
                  <tr key={idx}>
                    {result.columns.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? 'text-right font-mono' : undefined}>
                        {formatCell(row[c.key], c.format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </EnterpriseRegisterTableShell>
          {result.summary ? (
            <p className="mt-3 text-[12px] text-erp-muted">
              {result.summary.map((s) => `${s.label}: ${s.value}`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}

function FilterField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-erp-muted">{label}</label>
      {children}
    </div>
  )
}
