import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileBarChart2, Info, ShieldAlert } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  exportManufacturingReport,
  getManufacturingReportCatalog,
  queryManufacturingReport,
  type ManufacturingReportCatalogItem,
  type ManufacturingReportFilters,
  type ManufacturingReportResult,
} from '@/services/api/opsReportsApi'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function labelFromKey(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Phase 7D — generic ops report runner: filter bar, KPI summary, table, CSV export,
 * calculation notes and pagination for a single `reports/manufacturing/:key` report.
 * API-mode only — the demo report engine keeps using `ManufacturingReportsPage`'s inline
 * runner via `manufacturingSettingsService`.
 */
export function ManufacturingReportRunnerPage() {
  const { reportKey = '' } = useParams<{ reportKey: string }>()
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()

  const [catalogItem, setCatalogItem] = useState<ManufacturingReportCatalogItem | null>(null)
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [result, setResult] = useState<ManufacturingReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const filters: ManufacturingReportFilters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      status: status || undefined,
      search: search.trim() || undefined,
      page,
      pageSize,
    }),
    [dateFrom, dateTo, status, search, page],
  )

  useEffect(() => {
    if (!isApiMode()) return
    let cancelled = false
    void getManufacturingReportCatalog()
      .then((res) => {
        if (cancelled) return
        const item = res.data.find((r) => r.key === reportKey) ?? null
        setCatalogItem(item)
      })
      .catch(() => setCatalogItem(null))
      .finally(() => {
        if (!cancelled) setCatalogLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [reportKey])

  const isUnavailable = catalogItem?.status === 'UNAVAILABLE'

  const runReport = useCallback(async () => {
    if (!isApiMode() || isUnavailable) return
    setLoading(true)
    try {
      const res = await queryManufacturingReport(reportKey, filters)
      setResult(res.data)
    } catch (error) {
      setResult(null)
      notify.error(error instanceof Error ? error.message : 'Failed to run report')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey, filters, isUnavailable])

  useEffect(() => {
    if (!isApiMode() || !catalogLoaded) return
    void runReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLoaded, reportKey, page])

  const applyFilters = () => {
    setPage(1)
    void runReport()
  }

  const onExport = async () => {
    if (!perms.canExportReports) return
    setExporting(true)
    try {
      const { blob, filename } = await exportManufacturingReport(reportKey, filters)
      downloadBlob(blob, filename ?? `${reportKey}.csv`)
      notify.success('Export downloaded')
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo(() => {
    if (!result) return []
    return result.columns.map((c) => (typeof c === 'string' ? { accessorKey: c, header: humanize(c) } : { accessorKey: c.key, header: c.label }))
  }, [result])

  const tableData = useMemo(() => {
    if (!result) return []
    return result.rows.map((row, idx) => ({ id: String(row.id ?? idx), ...row }))
  }, [result])

  const kpiStrip = useMemo<EnterpriseKpiItem[] | undefined>(() => {
    if (!result?.summary) return undefined
    const entries = Object.entries(result.summary).slice(0, 8)
    if (entries.length === 0) return undefined
    return entries.map(([key, value]) => ({
      id: key,
      label: humanize(key),
      value: typeof value === 'number' ? value : String(value ?? '—'),
    }))
  }, [result])

  const title = catalogItem?.label ?? labelFromKey(reportKey)

  if (!perms.canViewReports) {
    return (
      <ProductionPageHeader title={title} favoritePath={`/manufacturing/reports/${reportKey}`}>
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="Missing manufacturing reports view permission."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title={title}
      description={catalogItem?.description ?? 'Filter, review, and export this operations report.'}
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Reports', to: '/manufacturing/reports' },
        { label: title },
      ]}
      favoritePath={`/manufacturing/reports/${reportKey}`}
      secondaryActions={
        isApiMode()
          ? [
              { id: 'back', label: 'All Reports', icon: ArrowLeft, onClick: () => navigate('/manufacturing/reports') },
              ...(perms.canExportReports
                ? [
                    {
                      id: 'export',
                      label: exporting ? 'Exporting…' : 'Export CSV',
                      icon: Download,
                      onClick: () => void onExport(),
                      disabled: exporting || loading || isUnavailable || !result,
                    },
                  ]
                : []),
            ]
          : undefined
      }
      kpiStrip={isApiMode() && !loading ? kpiStrip : undefined}
      filterBar={
        isApiMode() && !isUnavailable ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Date from">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Date from" />
            </FormField>
            <FormField label="Date to">
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Date to" />
            </FormField>
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Search">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search" />
            </FormField>
            <div className="flex items-end">
              <Button className="w-full" disabled={loading} onClick={applyFilters}>
                Apply filters
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      {!isApiMode() ? (
        <div className="space-y-3">
          <ManufacturingDemoBanner message="Report runner requires API mode — enable VITE_USE_API to query live ops reports." />
          <ProductionEmptyState
            icon={FileBarChart2}
            title="Report runner requires API mode"
            description="Open Manufacturing Reports for the demo report engine, or turn on VITE_USE_API to run this report live."
            action={
              <Button size="sm" onClick={() => navigate('/manufacturing/reports')}>
                Back to Reports
              </Button>
            }
          />
        </div>
      ) : !catalogLoaded ? (
        <LoadingState variant="table" rows={6} />
      ) : isUnavailable ? (
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Report unavailable"
          description={catalogItem?.reason ?? 'This report is not available for your tenant or role.'}
          action={
            <Button size="sm" onClick={() => navigate('/manufacturing/reports')}>
              Back to Reports
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {loading ? <LoadingState variant="table" rows={8} /> : null}

          {!loading && result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-erp-muted">
                <span>
                  {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
                  {result.pagination ? ` · Page ${result.pagination.page} of ${result.pagination.totalPages ?? '—'}` : ''}
                </span>
                {result.generatedAt ? <span>Generated {formatDateTime(result.generatedAt)}</span> : null}
              </div>

              {result.calculationNotes && result.calculationNotes.length > 0 ? (
                <div className="space-y-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Info className="h-3.5 w-3.5" aria-hidden />
                    Calculation notes
                  </div>
                  <ul className="ml-5 list-disc space-y-0.5">
                    {result.calculationNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
                {tableData.length === 0 ? (
                  <ProductionEmptyState icon={FileBarChart2} title="No rows" description="No rows for the selected filters." />
                ) : (
                  <DataTable columns={columns as never} data={tableData} />
                )}
              </div>

              {result.pagination ? (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12px] text-erp-muted">
                    Page {result.pagination.page} · {result.pagination.total} total row{result.pagination.total === 1 ? '' : 's'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={loading || (result.pagination.totalPages != null && page >= result.pagination.totalPages)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {!loading && !result ? (
            <ProductionEmptyState
              icon={FileBarChart2}
              title="Could not load report"
              description="Adjust filters and run the report again."
              action={
                <Button size="sm" onClick={() => void runReport()}>
                  Retry
                </Button>
              }
            />
          ) : null}
        </div>
      )}
    </ProductionPageHeader>
  )
}
