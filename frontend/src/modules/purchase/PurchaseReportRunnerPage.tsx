import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Download,
  FileDown,
  Filter,
  Printer,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getPurchaseReportEntry,
  getPurchaseReportFilterOptions,
  isPurchaseReportId,
  runPurchaseReport,
} from '@/services/purchase/purchaseReportsService'
import type {
  PurchaseReportFilterOptions,
  PurchaseReportFilters,
  PurchaseReportResult,
  PurchaseReportRow,
} from '@/types/purchaseReports'
import { exportRowsToCsv } from '@/utils/exportCsv'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { notify } from '@/store/toastStore'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function financialYearStart(iso = new Date().toISOString().slice(0, 10)): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const fyStartYear = month >= 4 ? year : year - 1
  return `${fyStartYear}-04-01`
}

const DEFAULT_FILTERS: PurchaseReportFilters = {
  dateFrom: financialYearStart(),
  dateTo: new Date().toISOString().slice(0, 10),
  vendorId: '',
  itemId: '',
  category: '',
  locationId: '',
  department: '',
  status: '',
  search: '',
}

function formatCell(
  value: string | number | null | undefined,
  format?: 'text' | 'number' | 'currency' | 'date',
): string {
  if (value == null || value === '') return '—'
  if (format === 'currency') return formatCurrency(Number(value))
  if (format === 'date') {
    if (typeof value === 'string' && value !== '—') return formatDate(value)
    return String(value)
  }
  if (format === 'number') return String(value)
  return String(value)
}

function exportPdfDemo(result: PurchaseReportResult) {
  const lines = [
    result.title,
    result.description,
    `Generated: ${result.generatedAt}`,
    '',
    result.columns.map((c) => c.label).join('\t'),
    ...result.rows.map((row) =>
      result.columns
        .map((c) => formatCell(row[c.key], c.format))
        .join('\t'),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${result.reportId}-report.pdf.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function PurchaseReportRunnerPage() {
  const { reportId: reportIdParam } = useParams<{ reportId: string }>()
  const reportId = reportIdParam && isPurchaseReportId(reportIdParam) ? reportIdParam : null
  const catalogEntry = reportId ? getPurchaseReportEntry(reportId) : null

  const [draftFilters, setDraftFilters] = useState<PurchaseReportFilters>({ ...DEFAULT_FILTERS })
  const [appliedFilters, setAppliedFilters] = useState<PurchaseReportFilters>({ ...DEFAULT_FILTERS })
  const [options, setOptions] = useState<PurchaseReportFilterOptions | null>(null)
  const [result, setResult] = useState<PurchaseReportResult | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (!reportId) return
    let cancelled = false
    void getPurchaseReportFilterOptions(reportId).then((opts) => {
      if (!cancelled) setOptions(opts)
    })
    return () => {
      cancelled = true
    }
  }, [reportId])

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!reportId) return
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const data = await runPurchaseReport(reportId, {
          dateFrom: appliedFilters.dateFrom || undefined,
          dateTo: appliedFilters.dateTo || undefined,
          vendorId: appliedFilters.vendorId || undefined,
          itemId: appliedFilters.itemId || undefined,
          category: appliedFilters.category || undefined,
          locationId: appliedFilters.locationId || undefined,
          department: appliedFilters.department || undefined,
          status: appliedFilters.status || undefined,
          search: appliedFilters.search || undefined,
        })
        if (signal?.cancelled) return
        setResult(data)
        setLoadState(
          data.isPlaceholder || data.rows.length === 0 ? 'empty' : 'ready',
        )
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to run report')
        setResult(null)
        setLoadState('error')
      }
    },
    [reportId, appliedFilters],
  )

  useEffect(() => {
    if (!reportId) return
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken, reportId])

  const chipList = useMemo(() => {
    const chips: Array<{ id: string; label: string }> = []
    if (draftFilters.dateFrom) chips.push({ id: 'dateFrom', label: `From ${draftFilters.dateFrom}` })
    if (draftFilters.dateTo) chips.push({ id: 'dateTo', label: `To ${draftFilters.dateTo}` })
    if (draftFilters.vendorId) {
      const name = options?.vendors.find((v) => v.id === draftFilters.vendorId)?.name
      chips.push({ id: 'vendorId', label: `Vendor: ${name ?? draftFilters.vendorId}` })
    }
    if (draftFilters.itemId) {
      const item = options?.items.find((i) => i.id === draftFilters.itemId)
      chips.push({ id: 'itemId', label: `Item: ${item?.code ?? draftFilters.itemId}` })
    }
    if (draftFilters.category) chips.push({ id: 'category', label: `Category: ${draftFilters.category}` })
    if (draftFilters.locationId) {
      const loc = options?.locations.find((l) => l.id === draftFilters.locationId)?.name
      chips.push({ id: 'locationId', label: `Location: ${loc ?? draftFilters.locationId}` })
    }
    if (draftFilters.department) chips.push({ id: 'department', label: `Dept: ${draftFilters.department}` })
    if (draftFilters.status) chips.push({ id: 'status', label: `Status: ${draftFilters.status}` })
    if (draftFilters.search) chips.push({ id: 'search', label: `Search: ${draftFilters.search}` })
    return chips
  }, [draftFilters, options])

  const columns = useMemo<ColumnDef<PurchaseReportRow>[]>(() => {
    if (!result) return []
    return result.columns.map((col) => ({
      id: col.key,
      accessorFn: (row) => row[col.key],
      header: col.label,
      meta: { align: col.align ?? 'left' },
      cell: ({ row }) => {
        const value = formatCell(row.original[col.key], col.format)
        const hrefRaw = col.hrefKey ? row.original[col.hrefKey] : null
        const href = typeof hrefRaw === 'string' && hrefRaw ? hrefRaw : null
        if (href) {
          return (
            <TableLink to={href} className="font-mono text-[13px]">
              {value}
            </TableLink>
          )
        }
        return <span className={col.format === 'currency' || col.format === 'number' ? 'tabular-nums' : undefined}>{value}</span>
      },
    }))
  }, [result])

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters })
    setRefreshToken((n) => n + 1)
    notify.info('Filters applied')
  }

  const resetFilters = () => {
    const next = { ...DEFAULT_FILTERS }
    setDraftFilters(next)
    setAppliedFilters(next)
    setRefreshToken((n) => n + 1)
    notify.info('Filters reset')
  }

  const exportExcel = () => {
    if (!result) return
    exportRowsToCsv(
      result.reportId,
      result.columns.map((c) => c.label),
      result.rows.map((row) => result.columns.map((c) => formatCell(row[c.key], c.format))),
    )
    notify.success('Exported to Excel (CSV)')
  }

  const exportPdf = () => {
    if (!result) return
    exportPdfDemo(result)
    notify.success('Exported PDF (demo text download)')
  }

  if (!reportId || !catalogEntry) {
    return (
      <OperationalPageShell
        title="Report not found"
        description="Unknown purchase report id."
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={purchaseBreadcrumbs('Reports', { label: 'Reports', to: '/purchase/reports' })}
      >
        <EmptyState
          icon={Filter}
          title="Report not found"
          description="Choose a report from the Purchase Reports hub."
          action={
            <Link to="/purchase/reports" className="erp-btn erp-btn--primary text-[13px]">
              Back to Reports
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={catalogEntry.title}
      description={catalogEntry.description}
      badge={catalogEntry.categoryLabel}
      variant="dynamics"
      favoritePath={`/purchase/reports/${reportId}`}
      breadcrumbs={purchaseBreadcrumbs(catalogEntry.title, {
        label: 'Reports',
        to: '/purchase/reports',
      })}
      commandBar={
        <ErpCommandBar
          primaryAction={{
            id: 'apply',
            label: 'Apply Filters',
            icon: Filter,
            onClick: applyFilters,
          }}
          secondaryActions={[
            {
              id: 'reset',
              label: 'Reset Filters',
              icon: RotateCcw,
              onClick: resetFilters,
            },
            {
              id: 'excel',
              label: 'Export to Excel',
              icon: Download,
              onClick: exportExcel,
              disabled: !result || result.rows.length === 0,
            },
            {
              id: 'pdf',
              label: 'Export to PDF',
              icon: FileDown,
              onClick: exportPdf,
              disabled: !result || result.rows.length === 0,
            },
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              onClick: () => window.print(),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => {
                setRefreshToken((n) => n + 1)
                notify.info('Report refreshed')
              },
            },
          ]}
        />
      }
      insights={
        result?.summary.map((s, idx) => ({
          label: s.label,
          value: typeof s.value === 'number' && s.label.toLowerCase().includes('value')
            ? formatCurrency(s.value)
            : s.value,
          accent: (idx === 0 ? 'blue' : 'slate') as 'blue' | 'slate',
        })) ?? []
      }
      filterBar={
        <CrmListFilterBar
          className="crm-list-filter-bar--purchase"
          search={draftFilters.search ?? ''}
          onSearchChange={(v) => setDraftFilters((f) => ({ ...f, search: v }))}
          searchPlaceholder="Search…"
          showCommandPaletteHint={false}
          chips={chipList}
          onRemoveChip={(id) => {
            if (id === 'dateFrom') setDraftFilters((f) => ({ ...f, dateFrom: '' }))
            else if (id === 'dateTo') setDraftFilters((f) => ({ ...f, dateTo: '' }))
            else if (id === 'vendorId') setDraftFilters((f) => ({ ...f, vendorId: '' }))
            else if (id === 'itemId') setDraftFilters((f) => ({ ...f, itemId: '' }))
            else if (id === 'category') setDraftFilters((f) => ({ ...f, category: '' }))
            else if (id === 'locationId') setDraftFilters((f) => ({ ...f, locationId: '' }))
            else if (id === 'department') setDraftFilters((f) => ({ ...f, department: '' }))
            else if (id === 'status') setDraftFilters((f) => ({ ...f, status: '' }))
            else if (id === 'search') setDraftFilters((f) => ({ ...f, search: '' }))
          }}
          onClearAll={resetFilters}
          sort={
            <CrmListSortSelect
              value={draftFilters.status ?? ''}
              onChange={(v) => setDraftFilters((f) => ({ ...f, status: v }))}
              aria-label="Filter by status"
              options={[
                { value: '', label: 'All statuses' },
                ...(options?.statuses ?? []).map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
          }
          afterFilters={
            <>
              <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-erp-muted">
                From
                <input
                  type="date"
                  className="erp-input crm-list-filter-bar__control min-w-[9.5rem] text-[12px]"
                  value={draftFilters.dateFrom ?? ''}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </label>
              <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-erp-muted">
                To
                <input
                  type="date"
                  className="erp-input crm-list-filter-bar__control min-w-[9.5rem] text-[12px]"
                  value={draftFilters.dateTo ?? ''}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </label>
              <Select
                native
                value={draftFilters.vendorId ?? ''}
                onChange={(e) => setDraftFilters((f) => ({ ...f, vendorId: e.target.value }))}
                wrapClassName="crm-list-filter-bar__select-wrap shrink-0"
                className="crm-list-filter-bar__control"
                aria-label="Filter by vendor"
              >
                <option value="">All vendors</option>
                {(options?.vendors ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <Select
                native
                value={draftFilters.itemId ?? ''}
                onChange={(e) => setDraftFilters((f) => ({ ...f, itemId: e.target.value }))}
                wrapClassName="crm-list-filter-bar__select-wrap shrink-0"
                className="crm-list-filter-bar__control"
                aria-label="Filter by item"
              >
                <option value="">All items</option>
                {(options?.items ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} — {i.name}
                  </option>
                ))}
              </Select>
              <Select
                native
                value={draftFilters.category ?? ''}
                onChange={(e) =>
                  setDraftFilters((f) => ({
                    ...f,
                    category: e.target.value as PurchaseReportFilters['category'],
                  }))
                }
                wrapClassName="crm-list-filter-bar__select-wrap shrink-0"
                className="crm-list-filter-bar__control"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {(options?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select
                native
                value={draftFilters.locationId ?? ''}
                onChange={(e) => setDraftFilters((f) => ({ ...f, locationId: e.target.value }))}
                wrapClassName="crm-list-filter-bar__select-wrap shrink-0"
                className="crm-list-filter-bar__control"
                aria-label="Filter by location"
              >
                <option value="">All locations</option>
                {(options?.locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Select
                native
                value={draftFilters.department ?? ''}
                onChange={(e) => setDraftFilters((f) => ({ ...f, department: e.target.value }))}
                wrapClassName="crm-list-filter-bar__select-wrap shrink-0"
                className="crm-list-filter-bar__control"
                aria-label="Filter by department"
              >
                <option value="">All departments</option>
                {(options?.departments ?? []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </>
          }
        />
      }
    >
      {loadState === 'loading' ? (
        <LoadingState variant="table" rows={8} cols={8} />
      ) : loadState === 'error' ? (
        <EmptyState
          icon={Filter}
          title="Could not run report"
          description={errorMessage ?? 'Unexpected error'}
          action={
            <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          }
        />
      ) : result?.isPlaceholder ? (
        <EmptyState
          icon={FileDown}
          title="Integration pending"
          description={
            result.placeholderMessage ??
            'This report will be available once the related finance integration is connected.'
          }
        />
      ) : loadState === 'empty' || !result || result.rows.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No rows for current filters"
          description="Adjust date range or clear filters, then Apply Filters."
          action={
            <button type="button" className="erp-btn erp-btn--primary text-[13px]" onClick={resetFilters}>
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="print:block">
          <DataTable columns={columns} data={result.rows} />
        </div>
      )}
    </OperationalPageShell>
  )
}
