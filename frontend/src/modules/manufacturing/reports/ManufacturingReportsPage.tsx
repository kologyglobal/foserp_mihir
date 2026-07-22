import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, FileBarChart2, Printer, ShieldAlert } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import {
  exportManufacturingReport,
  getManufacturingPrintPreview,
  getManufacturingReports,
  listManufacturingReportDefinitions,
} from '@/services/manufacturing'
import {
  getManufacturingReportCatalog,
  type ManufacturingReportCatalogItem,
} from '@/services/api/opsReportsApi'
import type {
  ManufacturingReportFilter,
  ManufacturingReportId,
  ManufacturingReportResult,
} from '@/types/manufacturingSettings'
import { WO_LIST_STATUS_LABELS, type WorkOrderListStatus } from '@/types/manufacturingWorkOrder'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/dates/format'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

const WAREHOUSES = ['RM Stores', 'FG Stores', 'WIP Stores', 'Scrap Yard']

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(WO_LIST_STATUS_LABELS) as WorkOrderListStatus[]).map((s) => ({
    value: s,
    label: WO_LIST_STATUS_LABELS[s],
  })),
  { value: 'draft', label: 'Draft (Job Work)' },
  { value: 'material_sent', label: 'Material Sent (Job Work)' },
  { value: 'partially_received', label: 'Partially Received (Job Work)' },
  { value: 'reconciliation_pending', label: 'Reconciliation Pending (Job Work)' },
]

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function printHtml(title: string, html: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
  if (!win) {
    notify.error('Allow pop-ups to print')
    return
  }
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; font-size: 12px; color: #111; padding: 16px; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #f3f4f6; }
      @media print { button { display: none; } }
    </style>
  </head><body>${html}<p><button onclick="window.print()">Print</button></p></body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 250)
}

function moduleLabel(module: string): string {
  return module
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Phase 7D — API-mode report catalog: loads `reports/manufacturing/catalog`, groups by
 * module, and navigates into `ManufacturingReportRunnerPage` for AVAILABLE reports.
 * UNAVAILABLE reports render disabled with their reason — never as clickable/live data.
 */
function ManufacturingReportsApiCatalog() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [items, setItems] = useState<ManufacturingReportCatalogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void getManufacturingReportCatalog()
      .then((res) => {
        if (!cancelled) setItems(res.data)
      })
      .catch((error) => {
        if (!cancelled) {
          setItems([])
          notify.error(error instanceof Error ? error.message : 'Failed to load report catalog')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, ManufacturingReportCatalogItem[]>()
    for (const item of items) {
      const list = map.get(item.module) ?? []
      list.push(item)
      map.set(item.module, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  if (!perms.canViewReports) {
    return (
      <ProductionPageHeader title="Manufacturing Reports" favoritePath="/manufacturing/reports">
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
      title="Manufacturing Reports"
      description="Live ops reports across manufacturing, shopfloor, quality, and dispatch."
      breadcrumbs={[{ label: 'Manufacturing & Production', to: '/manufacturing' }, { label: 'Reports' }]}
      favoritePath="/manufacturing/reports"
    >
      {loading ? (
        <LoadingState variant="table" rows={8} />
      ) : items.length === 0 ? (
        <ProductionEmptyState
          icon={FileBarChart2}
          title="No reports available"
          description="The report catalog is empty for this tenant, or the ops-reports API is not reachable yet."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([module, reports]) => (
            <section key={module} className="space-y-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                {moduleLabel(module)}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {reports.map((report) => {
                  const unavailable = report.status === 'UNAVAILABLE'
                  return (
                    <button
                      key={report.key}
                      type="button"
                      disabled={unavailable}
                      onClick={() => !unavailable && navigate(`/manufacturing/reports/${report.key}`)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition',
                        unavailable
                          ? 'cursor-not-allowed border-erp-border bg-slate-50 opacity-70'
                          : 'border-erp-border bg-white hover:border-erp-primary/40 hover:bg-erp-surface-alt/40',
                      )}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <FileBarChart2 className={cn('h-4 w-4', unavailable ? 'text-erp-muted' : 'text-erp-primary')} aria-hidden />
                        {report.category ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-erp-muted">
                            {report.category.replace(/_/g, ' ')}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="text-[13px] font-semibold text-erp-text">{report.label}</h3>
                      {report.description ? <p className="mt-1 text-[12px] text-erp-muted">{report.description}</p> : null}
                      {unavailable ? (
                        <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                          Unavailable{report.reason ? ` — ${report.reason}` : ''}
                        </p>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </ProductionPageHeader>
  )
}

export function ManufacturingReportsPage() {
  if (isApiMode()) return <ManufacturingReportsApiCatalog />
  return <ManufacturingReportsDemoPage />
}

function ManufacturingReportsDemoPage() {
  const perms = useManufacturingPermissions()
  const catalog = useMemo(
    () =>
      listManufacturingReportDefinitions().filter(
        (item) => !item.requiresCostPermission || perms.canViewCost || perms.canViewJobWorkCost,
      ),
    [perms.canViewCost, perms.canViewJobWorkCost],
  )

  const [reportId, setReportId] = useState<ManufacturingReportId | null>(null)
  const [result, setResult] = useState<ManufacturingReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [item, setItem] = useState('')
  const [status, setStatus] = useState('all')
  const [warehouse, setWarehouse] = useState('')

  const selected = catalog.find((r) => r.id === reportId) ?? null

  const filter: ManufacturingReportFilter = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      item: item.trim() || undefined,
      finishedItem: item.trim() || undefined,
      status: status === 'all' ? undefined : status,
      warehouse: warehouse || undefined,
    }),
    [dateFrom, dateTo, item, status, warehouse],
  )

  const runReport = useCallback(async (id: ManufacturingReportId) => {
    setLoading(true)
    try {
      const data = await getManufacturingReports(id, filter)
      setResult(data)
    } catch {
      notify.error('Failed to run report')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (!reportId) return
    void runReport(reportId)
  }, [reportId, runReport])

  const openReport = (id: ManufacturingReportId) => {
    setReportId(id)
    setResult(null)
  }

  const backToCards = () => {
    setReportId(null)
    setResult(null)
  }

  const onExport = async () => {
    if (!reportId || !perms.canExportReports) return
    const r = await exportManufacturingReport(reportId, 'csv', filter)
    if (!r.ok || !r.csv) {
      notify.error('Export failed')
      return
    }
    downloadCsv(r.fileName, r.csv)
    notify.success(`Exported ${r.fileName}`)
  }

  const onPrint = async () => {
    if (!reportId) return
    const r = await getManufacturingPrintPreview(reportId, filter)
    if (!r.ok) {
      notify.error('Print preview failed')
      return
    }
    printHtml(r.title, r.html)
  }

  const tableData = useMemo(
    () => (result ? result.rows.map((row) => ({ id: row.id, ...row.cells })) : []),
    [result],
  )

  const columns = useMemo(
    () => (result ? result.columns.map((column) => ({ accessorKey: column, header: column })) : []),
    [result],
  )

  if (!perms.canViewReports) {
    return (
      <ProductionPageHeader title="Manufacturing Reports" favoritePath="/manufacturing/reports">
        <ProductionEmptyState
          icon={FileBarChart2}
          title="Access denied"
          description="Missing manufacturing reports view permission."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title={selected ? selected.label : 'Manufacturing Reports'}
      description={
        selected
          ? selected.description
          : 'Shows production performance across Work Orders — filter, export CSV, print.'
      }
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Reports', to: reportId ? '/manufacturing/reports' : undefined },
        ...(selected ? [{ label: selected.label }] : []),
      ]}
      favoritePath="/manufacturing/reports"
      primaryAction={
        reportId
          ? {
              id: 'run',
              label: loading ? 'Running…' : 'Run Report',
              disabled: loading,
              onClick: () => void runReport(reportId),
            }
          : undefined
      }
      secondaryActions={
        reportId
          ? [
              { id: 'back', label: 'All Reports', icon: ArrowLeft, onClick: backToCards },
              ...(perms.canExportReports
                ? [
                    {
                      id: 'export',
                      label: 'Export',
                      icon: Download,
                      onClick: () => void onExport(),
                      disabled: loading || !result,
                    },
                  ]
                : []),
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => void onPrint(),
                disabled: loading || !result,
              },
            ]
          : undefined
      }
    >
      <div className="space-y-4">
        {!reportId ? (
          catalog.length === 0 ? (
            <ProductionEmptyState
              icon={FileBarChart2}
              title="No reports available"
              description="No report definitions match your permissions."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {catalog.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => openReport(report.id)}
                  className="rounded-lg border border-erp-border bg-white p-3 text-left transition hover:border-erp-primary/40 hover:bg-erp-surface-alt/40"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <FileBarChart2 className="h-4 w-4 text-erp-primary" aria-hidden />
                    <span className="text-[10px] font-medium uppercase tracking-wide text-erp-muted">
                      {report.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-[13px] font-semibold text-erp-text">{report.label}</h3>
                  <p className="mt-1 text-[12px] text-erp-muted">{report.description}</p>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <section className="rounded-lg border border-erp-border bg-white p-3 print:hidden">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <FormField label="Date from">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Date from" />
                </FormField>
                <FormField label="Date to">
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Date to" />
                </FormField>
                <FormField label="Item">
                  <Input
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="Item code / name"
                    aria-label="Item filter"
                  />
                </FormField>
                <FormField label="Status">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Warehouse">
                  <Select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} aria-label="Warehouse filter">
                    <option value="">All warehouses</option>
                    {WAREHOUSES.map((w) => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </Select>
                </FormField>
                <div className="flex items-end gap-2">
                  <Button className="w-full" disabled={loading} onClick={() => void runReport(reportId)}>
                    Apply filters
                  </Button>
                </div>
              </div>
            </section>

            {loading ? <LoadingState variant="table" rows={8} /> : null}

            {!loading && result ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-erp-muted">
                  <span>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span>
                  <span>Generated {formatDateTime(result.generatedAt)}</span>
                </div>
                <div className={cn('overflow-x-auto rounded-lg border border-erp-border bg-white', 'print:border-0')}>
                  {tableData.length === 0 ? (
                    <ProductionEmptyState
                      icon={FileBarChart2}
                      title="No rows"
                      description="No rows for the selected filters."
                    />
                  ) : (
                    <DataTable columns={columns as never} data={tableData} />
                  )}
                </div>
              </section>
            ) : null}

            {!loading && !result ? (
              <ProductionEmptyState
                icon={FileBarChart2}
                title="Could not load report"
                description="Adjust filters and run the report again."
              />
            ) : null}
          </>
        )}
      </div>
    </ProductionPageHeader>
  )
}
