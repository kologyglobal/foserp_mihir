import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { getPayableAllocation } from '@/services/bridges/payablesApiBridge'
import type { PayableAllocationDetail } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { parseDecimal } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableAllocationDetailPage() {
  const { allocationId } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [detail, setDetail] = useState<PayableAllocationDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!allocationId) return
    setLoading(true)
    try {
      setDetail(await getPayableAllocation(allocationId))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load allocation')
    } finally {
      setLoading(false)
    }
  }, [allocationId])

  useEffect(() => {
    if (perms.canViewAllocation && isApiMode()) void load()
  }, [load, perms.canViewAllocation])

  if (!perms.canViewAllocation) {
    return (
      <MoneyOutWorkspaceShell title="Allocation">
        <p className="text-[13px] text-erp-muted">You do not have permission to view allocations.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Allocation">
        <p className="text-[13px] text-erp-muted">Allocations require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading || !detail) {
    return (
      <MoneyOutWorkspaceShell title="Allocation">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const canReverse =
    perms.canReverseAllocation &&
    detail.batch.status !== 'REVERSED' &&
    detail.lines.some((l) => l.status === 'ACTIVE' && parseDecimal(l.amount) > parseDecimal(l.reversedAmount))

  return (
    <MoneyOutWorkspaceShell
      title={detail.batch.allocationReference}
      actions={
        <>
          {detail.payment.id ? (
            <ErpButton
              variant="secondary"
              onClick={() => navigate(`/accounting/money-out/vendor-payments/${detail.payment.id}`)}
            >
              View Payment
            </ErpButton>
          ) : null}
          {canReverse && (
            <ErpButton variant="ghost" onClick={() => navigate(`/accounting/money-out/reversals/allocation/${allocationId}`)}>
              Reverse
            </ErpButton>
          )}
        </>
      }
    >
      <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
        Subledger allocation only — no journal entry was created. Reversal restores open-item balances only (no GL).
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <dl className="space-y-2 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Reference</dt>
            <dd className="font-medium">{detail.batch.allocationReference}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Allocation date</dt>
            <dd className="tabular-nums">{detail.batch.allocationDate}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Status</dt>
            <dd className="font-medium">{detail.batch.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Currency</dt>
            <dd>
              {detail.batch.currencyCode} @ {detail.batch.exchangeRate}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Total allocated</dt>
            <dd className="font-semibold tabular-nums">
              {formatCurrency(parseDecimal(detail.batch.totalAllocatedAmount))}
            </dd>
          </div>
        </dl>

        {detail.source && (
          <div className="rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Source payment</h3>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Document</dt>
                <dd className="font-medium">
                  {detail.payment.id ? (
                    <Link
                      to={`/accounting/money-out/vendor-payments/${detail.payment.id}`}
                      className="text-erp-accent hover:underline"
                    >
                      {detail.payment.vendorPaymentNumber ?? detail.source.documentNumber}
                    </Link>
                  ) : (
                    detail.source.documentNumber
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Allocated</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(detail.source.allocatedAmount))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Outstanding</dt>
                <dd className="tabular-nums">{formatCurrency(parseDecimal(detail.source.outstandingAmount))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-erp-muted">Status</dt>
                <dd>{detail.source.status}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <h3 className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Allocated invoices</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-erp-border text-erp-muted">
              <th className="py-2 pr-3 font-medium">Invoice</th>
              <th className="py-2 pr-3 text-right font-medium">Allocated</th>
              <th className="py-2 pr-3 text-right font-medium">Outstanding after</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {detail.targets.map((t) => (
              <tr key={t.openItemId} className="border-b border-erp-border/60">
                <td className="py-2 pr-3">
                  {t.vendorInvoiceId ? (
                    <Link
                      to={`/accounting/money-out/vendor-invoices/${t.vendorInvoiceId}`}
                      className="text-erp-accent hover:underline"
                    >
                      {t.documentNumber ?? '—'}
                    </Link>
                  ) : (
                    (t.documentNumber ?? '—')
                  )}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(t.amount))}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {t.outstandingAmount != null ? formatCurrency(parseDecimal(t.outstandingAmount)) : '—'}
                </td>
                <td className="py-2">{t.status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MoneyOutWorkspaceShell>
  )
}
