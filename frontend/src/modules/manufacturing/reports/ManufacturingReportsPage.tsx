import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select } from '@/components/forms/Inputs'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  exportManufacturingReport,
  getManufacturingReports,
  listManufacturingReportDefinitions,
} from '@/services/manufacturing'
import type {
  ManufacturingReportDefinition,
  ManufacturingReportId,
  ManufacturingReportResult,
} from '@/types/manufacturingSettings'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'

export function ManufacturingReportsPage() {
  const perms = useManufacturingPermissions()
  const catalog = useMemo(
    () =>
      listManufacturingReportDefinitions().filter(
        (item) => !item.requiresCostPermission || perms.canViewCost || perms.canViewJobWorkCost,
      ),
    [perms.canViewCost, perms.canViewJobWorkCost],
  )
  const [reportId, setReportId] = useState<ManufacturingReportId | ''>('')
  const [result, setResult] = useState<ManufacturingReportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    setReportId(catalog[0]?.id ?? '')
  }, [catalog])

  const view = async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const data = await getManufacturingReports(reportId, {
        dateFrom: fromDate || undefined,
        dateTo: toDate || undefined,
      })
      setResult(data)
    } catch {
      notify.error('Failed to run report')
    } finally {
      setLoading(false)
    }
  }

  const exportIt = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!reportId) return
    const r = await exportManufacturingReport(reportId, format)
    notify.success(`Prepared ${r.fileName}`)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Manufacturing Reports"
      description="Production, material, job work and cost reports (demo)."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Reports' },
      ]}
      autoBreadcrumbs={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'view',
            label: 'View Report',
            disabled: !reportId || loading,
            onClick: () => void view(),
          }}
          secondaryActions={
            perms.canExportReports
              ? [
                  { id: 'csv', label: 'Export CSV', icon: Download, onClick: () => void exportIt('csv') },
                  { id: 'excel', label: 'Export Excel', icon: Download, onClick: () => void exportIt('excel') },
                  { id: 'pdf', label: 'Export PDF', icon: Download, onClick: () => void exportIt('pdf') },
                ]
              : []
          }
        />
      )}
    >
      <div className="mb-4 grid gap-3 rounded border border-erp-border p-3 md:grid-cols-3">
        <label className="text-sm">
          Report
          <Select
            value={reportId}
            onChange={(e) => setReportId(e.target.value as ManufacturingReportId)}
            aria-label="Report selector"
          >
            {catalog.map((report: ManufacturingReportDefinition) => (
              <option key={report.id} value={report.id}>{report.label}</option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          From
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="Report start date" />
        </label>
        <label className="text-sm">
          To
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="Report end date" />
        </label>
      </div>
      {loading ? (
        <LoadingState />
      ) : result ? (
        <div className="overflow-x-auto">
          <DataTable
            data={result.rows.map((row) => ({ id: row.id, ...row.cells }))}
            columns={result.columns.map((column) => ({ accessorKey: column, header: column }))}
          />
        </div>
      ) : (
        <p className="text-sm text-erp-muted">Choose a report and click View Report.</p>
      )}
    </OperationalPageShell>
  )
}
