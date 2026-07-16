import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HandCoins, RefreshCw, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  PayableConfirmModal,
  PayablesWorkspaceTabs,
  VendorAdvanceStatusBadge,
} from '@/components/accounting/payables'
import {
  applyVendorAdvanceDemo,
  DEFAULT_PAYABLE_FILTER,
  getPayableInvoices,
  getVendorAdvances,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayableFilter, VendorAdvance } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'partially_adjusted', label: 'Partially Applied' },
  { id: 'fully_adjusted', label: 'Fully Applied' },
  { id: 'cancelled', label: 'Cancelled' },
]

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function VendorAdvancesPage() {
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [filter, setFilter] = useState<PayableFilter>({ ...DEFAULT_PAYABLE_FILTER, advanceTab: 'all' })
  const [rows, setRows] = useState<VendorAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applyTarget, setApplyTarget] = useState<VendorAdvance | null>(null)
  const [invoiceId, setInvoiceId] = useState('')
  const [applyAmount, setApplyAmount] = useState('')
  const [invoices, setInvoices] = useState<{ id: string; invoiceNumber: string; outstandingBalance: number }[]>([])
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getVendorAdvances({ search: filter.search, advanceTab: filter.advanceTab }))
    } catch (e) {
      setError(e instanceof PayablesServiceError ? e.message : 'Failed to load vendor advances')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter.search, filter.advanceTab])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!applyTarget) {
      setInvoices([])
      return
    }
    void getPayableInvoices({ vendorId: applyTarget.vendorId })
      .then((list) =>
        setInvoices(
          list
            .filter((i) => i.outstandingBalance > 0)
            .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, outstandingBalance: i.outstandingBalance })),
        ),
      )
      .catch(() => setInvoices([]))
  }, [applyTarget])

  const kpiStrip = useMemo(
    () => [
      { id: 'total', label: 'Advances', value: rows.length, accent: 'blue' as const },
      {
        id: 'open',
        label: 'Open balance',
        value: formatCompactCurrency(rows.filter((r) => r.remainingAmount > 0).reduce((s, r) => s + r.remainingAmount, 0)),
        accent: 'amber' as const,
      },
      { id: 'open-count', label: 'Open advances', value: rows.filter((r) => r.status === 'Open').length, accent: 'slate' as const },
    ],
    [rows],
  )

  const openApply = (advance: VendorAdvance) => {
    if (!perms.canApplyAdvance) {
      notify.error('You do not have permission to apply advances.')
      return
    }
    setApplyTarget(advance)
    setInvoiceId('')
    setApplyAmount(String(advance.remainingAmount))
  }

  const confirmApply = async () => {
    if (!applyTarget) return
    const amount = Number(applyAmount)
    if (!invoiceId) {
      notify.error('Select an invoice.')
      return
    }
    if (!(amount > 0)) {
      notify.error('Application amount must be greater than zero.')
      return
    }
    setApplying(true)
    try {
      await applyVendorAdvanceDemo(applyTarget.id, invoiceId, amount)
      notify.success(`Advance ${applyTarget.advanceNumber} applied (demo).`)
      setApplyTarget(null)
      await load()
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Apply failed')
    } finally {
      setApplying(false)
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vendor Advances"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Vendor Advances' }]}
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
      title="Vendor Advances"
      description="Vendor advance payments and adjustment to open invoices — demo UI only."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Vendor Advances' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/advances"
      kpiStrip={kpiStrip}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <PayablesWorkspaceTabs active="advances" />
      <div className="mb-3 mt-3 space-y-3">
        <SearchInput
          value={filter.search}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search advance, vendor, PO…"
        />
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                filter.advanceTab === tab.id ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border',
              )}
              onClick={() => setFilter((f) => ({ ...f, advanceTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <EnterpriseRegisterTableShell>
        {loading ? (
          <div className="p-6">
            <LoadingState variant="table" rows={6} />
          </div>
        ) : null}
        {!loading && error ? (
          <div className="p-6">
            <EmptyState icon={HandCoins} title="Could not load advances" description={error} />
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={HandCoins} title="No vendor advances" />
          </div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-[13px]">
              <thead>
                <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                  <th className="px-3 py-2 text-left">Advance</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">PO</th>
                  <th className="px-3 py-2 text-right">Original</th>
                  <th className="px-3 py-2 text-right">Remaining</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/70 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-medium">{r.advanceNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{r.advanceDate}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() => navigate(`/accounting/payables/vendor/${r.vendorId}`)}
                      >
                        {r.vendorName}
                      </button>
                    </td>
                    <td className="px-3 py-2">{r.poNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.originalAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.remainingAmount)}</td>
                    <td className="px-3 py-2">
                      <VendorAdvanceStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.remainingAmount > 0 && r.status !== 'Cancelled' && perms.canApplyAdvance ? (
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-sky-700 hover:underline"
                          onClick={() => openApply(r)}
                        >
                          Apply to invoice
                        </button>
                      ) : (
                        <span className="text-erp-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <PayableConfirmModal
        open={!!applyTarget}
        onClose={() => setApplyTarget(null)}
        title="Apply advance to invoice"
        description={applyTarget ? `${applyTarget.advanceNumber} · Remaining ${formatCurrency(applyTarget.remainingAmount)}` : ''}
        confirmLabel={applying ? 'Applying…' : 'Apply (demo)'}
        onConfirm={() => void confirmApply()}
      >
        <div className="mt-4 space-y-3">
          <label className={labelCls}>
            Open invoice
            <select className={inputCls} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Select invoice…</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} · Bal {formatCurrency(i.outstandingBalance)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Amount to apply (₹)
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={applyAmount}
              onChange={(e) => setApplyAmount(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-erp-muted">Demo mode — adjusts local payables balances only.</p>
        </div>
      </PayableConfirmModal>
    </OperationalPageShell>
  )
}
