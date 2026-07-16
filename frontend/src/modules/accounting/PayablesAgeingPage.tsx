import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Download, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  PayableEmptyState,
  PayablesSummaryCards,
  PayablesWorkspaceTabs,
} from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  exportPayables,
  getPayablesAgeing,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { AgeingBasis, PayableAgeingResult, PayableFilter } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { FINANCIAL_YEAR_OPTIONS, downloadTextFile } from './payablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'
type AgeingView = 'vendor' | 'invoice' | 'msme'

const AGEING_BASES: AgeingBasis[] = ['Due Date', 'Posting Date', 'Invoice Date']

export function PayablesAgeingPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({
    ...DEFAULT_PAYABLE_FILTER,
    workspaceTab: 'ageing',
  })
  const [result, setResult] = useState<PayableAgeingResult | null>(null)
  const [view, setView] = useState<AgeingView>('vendor')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [exportOpen, setExportOpen] = useState(false)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const data = await getPayablesAgeing(filter)
      if (signal?.cancelled) return
      setResult(data)
      const empty =
        data.vendorWise.length === 0 && data.invoiceWise.length === 0 && data.msmeWise.length === 0
      setLoadState(empty ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Ageing could not be loaded.')
      setLoadState('error')
    }
  }, [filter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    if (!result) return []
    const s = result.summary
    return [
      { id: 'total', label: 'Total Outstanding', value: formatCompactCurrency(s.totalOutstanding), helper: formatCurrency(s.totalOutstanding), accent: 'blue' },
      { id: 'notDue', label: 'Not Due', value: formatCompactCurrency(s.notDue), accent: 'green' },
      { id: 'd30', label: '1–30 Days', value: formatCompactCurrency(s.d1to30), accent: 'amber' },
      { id: 'd60', label: '31–60 Days', value: formatCompactCurrency(s.d31to60), accent: 'amber' },
      { id: 'd90', label: '61–90 Days', value: formatCompactCurrency(s.d61to90), accent: 'red' },
      { id: 'above90', label: 'Above 90 Days', value: formatCompactCurrency(s.above90), accent: 'red' },
    ]
  }, [result])

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const scope = view === 'msme' ? 'msme_ageing' : 'open_invoices'
      const out = await exportPayables({ scope, format, filter })
      downloadTextFile(out.filename, out.content)
      notify.success(out.disclaimer)
      setExportOpen(false)
    } catch (err) {
      notify.error(err instanceof PayablesServiceError ? err.message : 'Export failed')
    }
  }

  const drillToInvoices = (bucket: string, vendorId?: string) => {
    const params = new URLSearchParams({ ageingBucket: bucket })
    if (vendorId) params.set('vendorId', vendorId)
    navigate(`/accounting/payables/invoices?${params.toString()}`)
  }

  if (!perms.canView || !perms.canViewAgeing) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vendor Ageing"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Ageing' },
        ]}
        autoBreadcrumbs={false}
      >
        <PayableEmptyState title="Access denied" description="You cannot view vendor ageing." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Vendor Ageing"
      description="Vendor-wise, invoice-wise and MSME ageing by due, posting or invoice date."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Ageing' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/ageing"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => setExportOpen((o) => !o),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setRefreshToken((n) => n + 1),
            },
          ]}
        />
      )}
    >
      <PayablesWorkspaceTabs active="ageing" />

      <div className="mb-3 mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <label className="text-[12px] font-semibold">
          As of date
          <input
            type="date"
            className="erp-input mt-1 h-9 text-[12px]"
            value={filter.asOfDate}
            onChange={(e) => setFilter((f) => ({ ...f, asOfDate: e.target.value }))}
          />
        </label>
        <label className="text-[12px] font-semibold">
          Financial year
          <select
            className="erp-input mt-1 h-9 min-w-[10rem] text-[12px]"
            value={filter.financialYear}
            onChange={(e) => {
              const fy = FINANCIAL_YEAR_OPTIONS.find((o) => o.value === e.target.value)
              setFilter((f) => ({
                ...f,
                financialYear: e.target.value,
                asOfDate: fy ? fy.to : f.asOfDate,
              }))
            }}
          >
            <option value="">Select FY…</option>
            {FINANCIAL_YEAR_OPTIONS.map((fy) => (
              <option key={fy.value} value={fy.value}>
                {fy.value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] font-semibold">
          Ageing basis
          <select
            className="erp-input mt-1 h-9 min-w-[10rem] text-[12px]"
            value={filter.ageingBasis}
            onChange={(e) => setFilter((f) => ({ ...f, ageingBasis: e.target.value as AgeingBasis }))}
          >
            {AGEING_BASES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <div className="relative ml-auto">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
            onClick={() => setExportOpen((o) => !o)}
            disabled={!perms.canExport}
          >
            <Download className="h-3.5 w-3.5" />
            Export
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {exportOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
              {(['csv', 'excel', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] uppercase hover:bg-erp-surface-alt"
                  onClick={() => void handleExport(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="mb-3">
          <PayablesSummaryCards items={kpiItems} />
        </div>
      ) : null}

      <div className="mb-2 flex gap-1 border-b border-erp-border">
        {(
          [
            ['vendor', 'Vendor-wise'],
            ['invoice', 'Invoice-wise'],
            ['msme', 'MSME (preview)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              view === id ? 'border border-b-white border-erp-border bg-white text-erp-primary' : 'text-erp-muted',
            )}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'msme' ? (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900 ring-1 ring-amber-200">
          MSME ageing is a frontend preview only — not connected to statutory MSME compliance reporting.
        </p>
      ) : null}

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <PayableEmptyState
          title="Ageing analysis could not be loaded."
          description={errorMessage ?? undefined}
          actions={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'empty' ? (
        <PayableEmptyState
          title="No outstanding balances for ageing."
          description="Change as-of date or basis to continue."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => setFilter((f) => ({ ...f, asOfDate: new Date().toISOString().slice(0, 10) }))}
            >
              Reset As of Date
            </button>
          )}
        />
      ) : null}

      {loadState === 'ready' && result ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            {view === 'vendor' ? (
              <table className="w-full min-w-[72rem] text-[12px]">
                <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2 text-right">Not Due</th>
                    <th className="px-3 py-2 text-right">1–30</th>
                    <th className="px-3 py-2 text-right">31–60</th>
                    <th className="px-3 py-2 text-right">61–90</th>
                    <th className="px-3 py-2 text-right">91–180</th>
                    <th className="px-3 py-2 text-right">180+</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.vendorWise.map((row) => (
                    <tr key={row.vendorId} className="border-t border-erp-border">
                      <td className="px-3 py-2">
                        <Link
                          to={`/accounting/payables/vendor/${row.vendorId}`}
                          className="font-semibold text-erp-primary hover:underline"
                        >
                          {row.vendorName}
                        </Link>
                      </td>
                      {(
                        [
                          ['Not Due', row.notDue],
                          ['1–30 Days', row.d1to30],
                          ['31–60 Days', row.d31to60],
                          ['61–90 Days', row.d61to90],
                          ['91–180 Days', row.d91to180],
                          ['Above 180 Days', row.above180],
                        ] as const
                      ).map(([bucket, amt]) => (
                        <td key={bucket} className="px-3 py-2 text-right tabular-nums">
                          {amt > 0 ? (
                            <button
                              type="button"
                              className="font-semibold text-erp-primary hover:underline"
                              onClick={() => drillToInvoices(bucket, row.vendorId)}
                            >
                              {formatCurrency(amt)}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(row.totalOutstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : view === 'invoice' ? (
              <table className="w-full min-w-[64rem] text-[12px]">
                <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Bucket</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-right">Overdue Days</th>
                  </tr>
                </thead>
                <tbody>
                  {result.invoiceWise.map((inv) => (
                    <tr key={inv.id} className="border-t border-erp-border">
                      <td className="px-3 py-2">
                        <Link to={`/accounting/payables/invoice/${inv.id}`} className="font-mono text-erp-primary hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{inv.vendorName}</td>
                      <td className="px-3 py-2">{formatDate(inv.dueDate)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-erp-primary hover:underline"
                          onClick={() => drillToInvoices(inv.ageingBucket)}
                        >
                          {inv.ageingBucket}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(inv.outstandingBalance)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{inv.overdueDays > 0 ? inv.overdueDays : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[80rem] text-[12px]">
                <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">MSME Category</th>
                    <th className="px-3 py-2 text-right">Not Due</th>
                    <th className="px-3 py-2 text-right">1–30</th>
                    <th className="px-3 py-2 text-right">31–60</th>
                    <th className="px-3 py-2 text-right">61–90</th>
                    <th className="px-3 py-2 text-right">91–180</th>
                    <th className="px-3 py-2 text-right">180+</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.msmeWise.map((row) => (
                    <tr key={row.vendorId} className="border-t border-erp-border">
                      <td className="px-3 py-2">
                        <Link
                          to={`/accounting/payables/vendor/${row.vendorId}`}
                          className="font-semibold text-erp-primary hover:underline"
                        >
                          {row.vendorName}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{row.msmeCategory}</td>
                      {(
                        [
                          row.notDue,
                          row.d1to30,
                          row.d31to60,
                          row.d61to90,
                          row.d91to180,
                          row.above180,
                        ] as const
                      ).map((amt, idx) => (
                        <td key={idx} className="px-3 py-2 text-right tabular-nums">
                          {amt > 0 ? formatCurrency(amt) : '—'}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.totalOutstanding)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'text-[11px] font-semibold',
                            row.complianceRisk === 'Critical' || row.complianceRisk === 'High'
                              ? 'text-rose-700'
                              : row.complianceRisk === 'Medium'
                                ? 'text-amber-700'
                                : 'text-emerald-700',
                          )}
                        >
                          {row.complianceRisk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
