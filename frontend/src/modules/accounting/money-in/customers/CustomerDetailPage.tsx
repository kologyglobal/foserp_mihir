import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getCustomerSummary, listCustomerOpenItems } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CustomerReceivableDetailDto, OutstandingOpenItemDto } from '@/types/moneyIn'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

export function CustomerDetailPage() {
  const { customerId } = useParams()
  const perms = useMoneyInPermissions()
  const [summary, setSummary] = useState<CustomerReceivableDetailDto | null>(null)
  const [openItems, setOpenItems] = useState<OutstandingOpenItemDto[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    try {
      const leId = resolveLegalEntityId()
      const [s, items] = await Promise.all([
        getCustomerSummary(customerId, leId),
        listCustomerOpenItems(customerId, { legalEntityId: leId }),
      ])
      setSummary(s)
      setOpenItems(items.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  if (!perms.canView) {
    return (
      <MoneyInWorkspaceShell title="Customer">
        <p className="text-[13px] text-erp-muted">You do not have permission to view this customer.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell
      title={summary?.customerName ?? 'Customer'}
      commandBar={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !summary ? (
        <p className="text-[13px] text-erp-muted">Customer not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">Outstanding</p>
              <p className="text-[18px] font-semibold tabular-nums">{formatCurrency(parseDecimal(summary.outstandingAmount))}</p>
            </div>
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">Open items</p>
              <p className="text-[18px] font-semibold tabular-nums">{summary.openItemCount}</p>
            </div>
            <div className="rounded border border-erp-border bg-slate-50 p-3">
              <p className="text-[11px] uppercase text-erp-muted">Max overdue</p>
              <p className="text-[18px] font-semibold tabular-nums">{summary.maxDaysOverdue ?? '—'} days</p>
            </div>
          </div>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Open items</h3>
            {openItems.length === 0 ? (
              <p className="text-[12px] text-erp-muted">No open items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-erp-border text-erp-muted">
                      <th className="py-2 pr-2">Invoice</th>
                      <th className="py-2 pr-2">Due</th>
                      <th className="py-2 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openItems.map((o) => (
                      <tr key={o.openItemId} className="border-b border-erp-border/60">
                        <td className="py-2 pr-2">
                          {o.salesInvoiceId ? (
                            <Link to={`/accounting/money-in/invoices/${o.salesInvoiceId}`} className="text-erp-accent hover:underline">
                              {o.invoiceNumber}
                            </Link>
                          ) : (
                            o.invoiceNumber
                          )}
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{o.dueDate ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(o.outstandingAmount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </MoneyInWorkspaceShell>
  )
}
