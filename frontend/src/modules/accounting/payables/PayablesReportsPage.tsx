import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, Printer, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PayablesWorkspaceTabs } from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  exportPayables,
  getPayablesReports,
  getPayablesPrintPreview,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayableExportRequest, PayableFilter, PayablesReportCatalogEntry } from '@/types/payables'
import { hasPayablesPermission, usePayablesPermissions, type PayablesPermission } from '@/utils/permissions/payables'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const CATEGORIES = ['All', 'Outstanding', 'Ageing', 'Payments', 'Compliance', 'Matching', 'Disputes']

const SCOPE_BY_REPORT: Record<string, PayableExportRequest['scope']> = {
  'ap-rpt-outstanding': 'vendor_outstanding',
  'ap-rpt-ageing': 'ageing',
  'ap-rpt-msme': 'msme_ageing',
  'ap-rpt-payments': 'vendor_payments',
  'ap-rpt-tds': 'tds_summary',
  'ap-rpt-match': 'match_exceptions',
  'ap-rpt-proposals': 'payment_proposals',
  'ap-rpt-disputes': 'disputes',
}

export function PayablesReportsPage() {
  const perms = usePayablesPermissions()
  const [catalog, setCatalog] = useState<PayablesReportCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER })
  const [category, setCategory] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCatalog(await getPayablesReports())
    } catch (e) {
      setError(e instanceof PayablesServiceError ? e.message : 'Failed to load report catalog')
      setCatalog([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return catalog.filter((r) => {
      if (category !== 'All' && r.category !== category) return false
      if (filter.search) {
        const blob = `${r.name} ${r.description} ${r.category}`
        if (!blob.toLowerCase().includes(filter.search.toLowerCase())) return false
      }
      return hasPayablesPermission(r.permission as PayablesPermission)
    })
  }, [catalog, category, filter.search])

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!selected) return
    if (!perms.canExport) {
      notify.error('You do not have permission to export.')
      return
    }
    const scope = SCOPE_BY_REPORT[selected.id]
    if (!scope) {
      notify.info('Export placeholder — scope mapping not configured.')
      return
    }
    try {
      const result = await exportPayables({
        scope,
        format,
        filter: {
          search: filter.search,
          vendorId: filter.vendorId,
          asOfDate: filter.asOfDate,
          ageingBasis: filter.ageingBasis,
        },
        reportId: selected.id,
      })
      notify.success(`${result.filename} generated (demo). ${result.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!selected) return
    if (!perms.canPrint) {
      notify.error('You do not have permission to print.')
      return
    }
    try {
      const preview = await getPayablesPrintPreview('ageing_report', selected.id)
      notify.info(`${preview.title} — ${preview.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Print preview failed')
    }
  }

  if (!perms.canViewReports) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payables Reports"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Reports' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payables Reports"
      description="Report catalog with filters and export/print placeholders — demo UI only."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Reports' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/reports"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            ...(perms.canExport
              ? [{ id: 'export', label: 'Export', icon: Download, onClick: () => void handleExport('excel') }]
              : []),
            ...(perms.canPrint
              ? [{ id: 'print', label: 'Print preview', icon: Printer, onClick: () => void handlePrint() }]
              : []),
          ]}
        />
      }
    >
      <PayablesWorkspaceTabs active="reports" />
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <SearchInput
            value={filter.search}
            onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
            placeholder="Search reports…"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                  category === c ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
                )}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          {loading ? <LoadingState variant="table" rows={4} /> : null}
          {!loading && error ? <EmptyState icon={FileText} title="Could not load reports" description={error} /> : null}
          {!loading && !error && visible.length === 0 ? <EmptyState icon={FileText} title="No reports match filters" /> : null}
          {!loading && !error && visible.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {visible.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={cn(
                    'rounded border p-3 text-left transition-colors',
                    selected?.id === r.id
                      ? 'border-erp-primary/50 bg-sky-50/50'
                      : 'border-erp-border hover:border-erp-primary/30 hover:bg-erp-surface/60',
                  )}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div className="text-[11px] font-semibold uppercase text-erp-muted">{r.category}</div>
                  <div className="mt-1 text-[13px] font-semibold text-erp-text">{r.name}</div>
                  <p className="mt-1 text-[12px] text-erp-muted">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.formats.map((f) => (
                      <span key={f} className="rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase text-erp-muted">
                        {f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-4">
          <h3 className="mb-3 text-[13px] font-semibold">Filter panel</h3>
          <div className="space-y-3 text-[12px]">
            <label className="block font-medium text-erp-text">
              As-of date
              <input
                type="date"
                className="mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px]"
                value={filter.asOfDate}
                onChange={(e) => setFilter((f) => ({ ...f, asOfDate: e.target.value }))}
              />
            </label>
            <label className="block font-medium text-erp-text">
              Ageing basis
              <select
                className="mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px]"
                value={filter.ageingBasis}
                onChange={(e) => setFilter((f) => ({ ...f, ageingBasis: e.target.value as PayableFilter['ageingBasis'] }))}
              >
                <option value="Due Date">Due Date</option>
                <option value="Invoice Date">Invoice Date</option>
                <option value="Posting Date">Posting Date</option>
              </select>
            </label>
            <label className="block font-medium text-erp-text">
              Vendor ID (optional)
              <input
                type="text"
                className="mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px]"
                value={filter.vendorId}
                onChange={(e) => setFilter((f) => ({ ...f, vendorId: e.target.value }))}
                placeholder="Filter by vendor…"
              />
            </label>
          </div>
          {selected ? (
            <div className="mt-4 space-y-2 border-t border-erp-border pt-4">
              <p className="text-[12px] font-semibold text-erp-text">{selected.name}</p>
              <div className="flex flex-wrap gap-2">
                {perms.canExport
                  ? selected.formats.map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className="erp-btn erp-btn-ghost h-8 px-2 text-[11px]"
                        onClick={() => void handleExport(fmt)}
                      >
                        Export {fmt.toUpperCase()}
                      </button>
                    ))
                  : null}
                {perms.canPrint ? (
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-2 text-[11px]" onClick={() => void handlePrint()}>
                    Print preview
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] text-erp-muted">Export and print are demo placeholders — no backend document service.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </OperationalPageShell>
  )
}
