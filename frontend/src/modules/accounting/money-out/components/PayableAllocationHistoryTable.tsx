import { Link } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { formatCurrency } from '@/utils/formatters/currency'
import type { PayableAllocationHistoryRow } from '@/types/moneyOut'
import { parseDecimal } from '../moneyOutUi'

/**
 * Allocation history table. Shared by payment detail and invoice/adjustment detail.
 * Active batches link to allocation detail; reverse goes through the corrections preview.
 */
export function PayableAllocationHistoryTable({
  rows,
  emptyLabel = 'No allocations yet.',
  canReverse = false,
}: {
  rows: PayableAllocationHistoryRow[]
  emptyLabel?: string
  canReverse?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-erp-muted">{emptyLabel}</p>
  }

  const showActions = canReverse

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-erp-border text-erp-muted">
            <th className="py-2 pr-3 font-medium">Reference</th>
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Payment</th>
            <th className="py-2 pr-3 font-medium">Invoice</th>
            <th className="py-2 pr-3 text-right font-medium">Amount</th>
            <th className="py-2 font-medium">Status</th>
            {showActions ? <th className="py-2 font-medium">Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const reversible = row.status === 'ACTIVE' || row.status === 'PARTIALLY_REVERSED'
            return (
              <tr key={row.allocationLineId} className="border-b border-erp-border/60">
                <td className="py-2 pr-3">
                  <Link
                    to={`/accounting/money-out/allocations/${row.batchId}`}
                    className="font-medium text-erp-accent hover:underline"
                  >
                    {row.allocationReference}
                  </Link>
                </td>
                <td className="py-2 pr-3 tabular-nums">{row.allocationDate}</td>
                <td className="py-2 pr-3">{row.vendorPaymentNumber ?? '-'}</td>
                <td className="py-2 pr-3">{row.vendorInvoiceNumber ?? row.supplierInvoiceNumber ?? '-'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(row.amount))}</td>
                <td className="py-2">{row.status}</td>
                {showActions ? (
                  <td className="py-2">
                    {reversible ? (
                      <Link to={`/accounting/money-out/reversals/allocation/${row.batchId}`}>
                        <ErpButton variant="ghost" className="!px-2 !py-0.5 text-[11px]">
                          Reverse
                        </ErpButton>
                      </Link>
                    ) : (
                      <span className="text-erp-muted">-</span>
                    )}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-erp-muted">
        Allocations settle payable open items only (no journal entry). Reverse an active batch to restore
        outstanding balances — use Corrections → Allocation corrections or the Reverse action above.
      </p>
    </div>
  )
}
