import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Printer, FileBarChart2, ArrowLeft } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import {
  exportManufacturingReport,
  getManufacturingPrintPreview,
  getManufacturingReports,
  listManufacturingReportDefinitions,
} from '@/services/manufacturing'
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

export function ManufacturingReportsPage() {
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

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
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
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/reports"
      commandBar={
        reportId ? (
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'run',
              label: loading ? 'Running…' : 'Run Report',
              disabled: loading,
              onClick: () => void runReport(reportId),
            }}
            secondaryActions={[
              { id: 'back', label: 'All Reports', icon: ArrowLeft, onClick: backToCards },
              ...(perms.canExportReports
                ? [{ id: 'export', label: 'Export', icon: Download, onClick: () => void onExport(), disabled: loading || !result }]
                : []),
              { id: 'print', label: 'Print', icon: Printer, onClick: () => void onPrint(), disabled: loading || !result },
            ]}
          />
        ) : undefined
      }
    >
      <div className="space-y-4">
        <ManufacturingDemoBanner message="Reports show performance — they do not replace the Work Order as the place to execute." />

        {!reportId ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {catalog.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => openReport(report.id)}
                className="rounded-xl border border-erp-border bg-white p-4 text-left shadow-sm transition hover:border-erp-primary/40 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <FileBarChart2 className="h-5 w-5 text-erp-primary" aria-hidden />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                    {report.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-[14px] font-semibold text-erp-text">{report.label}</h3>
                <p className="mt-1 text-[12px] text-erp-muted">{report.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm print:hidden">
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
              <div className="mt-3 flex flex-wrap gap-2">
                {perms.canExportReports ? (
                  <Button size="sm" variant="secondary" disabled={loading || !result} onClick={() => void onExport()}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={loading || !result} onClick={() => void onPrint()}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </section>

            {loading ? (
              <LoadingState variant="card" />
            ) : result ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-erp-muted">
                  <span>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span>
                  <span>Generated {formatDateTime(result.generatedAt)}</span>
                </div>
                <div className={cn('overflow-x-auto rounded-xl border border-erp-border bg-white', 'print:border-0')}>
                  {tableData.length === 0 ? (
                    <p className="p-8 text-center text-[13px] text-erp-muted">No rows for the selected filters.</p>
                  ) : (
                    <DataTable columns={columns as never} data={tableData} />
                  )}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </OperationalPageShell>
  )
}
