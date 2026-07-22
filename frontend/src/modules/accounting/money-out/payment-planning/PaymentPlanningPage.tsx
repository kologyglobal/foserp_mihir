import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { getPaymentPlanning } from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PaymentPlanningDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const HORIZON_OPTIONS = [7, 14, 30] as const

export function PaymentPlanningPage() {
  const perms = useMoneyOutPermissions()
  const [plan, setPlan] = useState<PaymentPlanningDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [horizonDays, setHorizonDays] = useState<(typeof HORIZON_OPTIONS)[number]>(7)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setPlan(
        await getPaymentPlanning({
          legalEntityId: resolveLegalEntityId(),
          horizonDays,
        }),
      )
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payment planning')
    } finally {
      setLoading(false)
    }
  }, [horizonDays])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyOutWorkspaceShell title="Payment Planning">
        <p className="text-[13px] text-erp-muted">You do not have permission to view payment planning.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Payment Planning">
        <p className="text-[13px] text-erp-muted">
          Payment planning requires API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Payment Planning"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Select
            className="h-9 min-w-[160px] text-[12px]"
            value={String(horizonDays)}
            onChange={(e) => setHorizonDays(Number(e.target.value) as (typeof HORIZON_OPTIONS)[number])}
          >
            {HORIZON_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}-day horizon
              </option>
            ))}
          </Select>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !plan ? (
        <p className="text-[13px] text-erp-muted">No payment planning data.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[12px] text-erp-muted">
            As of {plan.asOfDate} · Horizon through {plan.horizonEndDate} ·{' '}
            <strong>{formatCurrency(parseDecimal(plan.totals.baseOutstandingAmount))}</strong> across{' '}
            {plan.totals.openItemCount} items / {plan.totals.vendorCount} vendors
          </p>

          {plan.vendors.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No payables due within the selected horizon.</p>
          ) : (
            plan.vendors.map((vendor) => (
              <section key={vendor.vendorId} className="rounded border border-erp-border">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-erp-border bg-slate-50 px-3 py-2">
                  <Link
                    to={`/accounting/money-out/vendors/${vendor.vendorId}`}
                    className="text-[13px] font-medium text-erp-accent hover:underline"
                  >
                    {vendor.vendorName ?? vendor.vendorCode}
                  </Link>
                  <span className="text-[12px] tabular-nums text-erp-muted">
                    {formatCurrency(parseDecimal(vendor.outstandingAmount))} · {vendor.openItemCount} items
                  </span>
                </div>
                <div className="divide-y divide-erp-border/60">
                  {vendor.dueGroups.map((group) => (
                    <div key={group.dueDate ?? 'no-due'} className="px-3 py-2">
                      <div className="mb-1 flex flex-wrap justify-between gap-2 text-[11px] text-erp-muted">
                        <span>Due {group.dueDate ?? 'No due date'}</span>
                        <span className="tabular-nums">
                          {formatCurrency(parseDecimal(group.outstandingAmount))} · {group.openItemCount} items
                        </span>
                      </div>
                      <ul className="space-y-1 text-[12px]">
                        {group.items.map((item) => (
                          <li key={item.openItemId} className="flex flex-wrap justify-between gap-2">
                            <span>
                              {item.vendorInvoiceId ? (
                                <Link
                                  to={`/accounting/money-out/vendor-invoices/${item.vendorInvoiceId}`}
                                  className="text-erp-accent hover:underline"
                                >
                                  {item.documentNumber ?? item.documentType}
                                </Link>
                              ) : (
                                (item.documentNumber ?? item.documentType)
                              )}
                              {item.daysOverdue != null && item.daysOverdue > 0 ? (
                                <span className="ml-1 text-rose-600">({item.daysOverdue}d overdue)</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums">{formatCurrency(parseDecimal(item.outstandingAmount))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
