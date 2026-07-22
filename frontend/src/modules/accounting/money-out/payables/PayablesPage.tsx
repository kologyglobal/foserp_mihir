import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { getPayableOverview, listPayableOutstanding } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { formatCompactCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayablesPage() {
  const perms = useMoneyOutPermissions()
  const [loading, setLoading] = useState(true)
  const [openItemCount, setOpenItemCount] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [outstandingBase, setOutstandingBase] = useState(0)
  const [overdueCount, setOverdueCount] = useState(0)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const leId = resolveLegalEntityId()
      const [overview, outstanding] = await Promise.all([
        getPayableOverview(leId),
        listPayableOutstanding({ legalEntityId: leId }),
      ])
      setOpenItemCount(overview.totals.openItemCount)
      setVendorCount(overview.totals.vendorCount)
      setOutstandingBase(parseDecimal(overview.totals.baseOutstandingAmount))
      setOverdueCount(outstanding.items.filter((o) => (o.daysOverdue ?? 0) > 0).length)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payables')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewOpenItem) void load()
  }, [load, perms.canViewOpenItem])

  if (!perms.canViewOpenItem) {
    return (
      <MoneyOutWorkspaceShell title="Payables">
        <p className="text-[13px] text-erp-muted">You do not have permission to view payables.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Payables">
        <p className="text-[13px] text-erp-muted">
          Payables require API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  const kpis = [
    { label: 'Open items', value: String(openItemCount) },
    { label: 'Vendors with balance', value: String(vendorCount) },
    { label: 'Outstanding (base)', value: formatCompactCurrency(outstandingBase) },
    { label: 'Overdue items (loaded page)', value: String(overdueCount) },
  ]

  return (
    <MoneyOutWorkspaceShell
      title="Payables"
      commandBar={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded border border-erp-border bg-slate-50 p-3">
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">{k.label}</div>
                <div className="mt-1 text-[18px] font-semibold tabular-nums text-erp-text">{k.value}</div>
              </div>
            ))}
          </div>
          <p className="mb-4 text-[11px] text-erp-muted">
            Totals from the AP reporting overview API for the current legal entity. Overdue count uses the first page of
            the outstanding register.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <RegisterCard
              title="Outstanding register"
              copy="All open payable items with due dates and buckets."
              to="/accounting/money-out/outstanding"
            />
            <RegisterCard title="Vendor summaries" copy="Outstanding position grouped by vendor." to="/accounting/money-out/vendors" />
            <RegisterCard
              title="Payment planning"
              copy="Read-only horizon view of upcoming payment dues."
              to="/accounting/money-out/payment-planning"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <RegisterCard
              title="Vendor Invoices"
              copy="Supplier liabilities and posting workflow."
              to="/accounting/money-out/vendor-invoices?status=POSTED"
            />
            <RegisterCard
              title="Vendor Payments"
              copy="Posted payments and allocation state."
              to="/accounting/money-out/vendor-payments?status=POSTED"
            />
            <RegisterCard
              title="AP Ageing"
              copy="Bucket analysis by due date or document age."
              to="/accounting/money-out/ageing"
            />
          </div>
        </>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function RegisterCard({ title, copy, to }: { title: string; copy: string; to: string }) {
  return (
    <Link to={to} className="rounded border border-erp-border bg-white p-3 hover:border-erp-accent">
      <div className="text-[13px] font-medium text-erp-text">{title}</div>
      <div className="mt-1 text-[11px] text-erp-muted">{copy}</div>
      <div className="mt-2 text-[12px] text-erp-accent">Open →</div>
    </Link>
  )
}
