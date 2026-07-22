import { Link } from 'react-router-dom'
import { formatCurrency } from '@/utils/formatters/currency'
import type { PayableAllocationHistoryRow } from '@/types/moneyOut'
import { parseDecimal } from '../moneyOutUi'

/**
 * Read-only allocation history table. Shared by payment detail and invoice detail.
 * `linkTo` controls whether the reference links to the allocation detail route.
 * No reversal / delete affordances — allocation reversal is not part of this phase.
 */
export function PayableAllocationHistoryTable({
  rows,
  emptyLabel = 'No allocations yet.',
}: {
  rows: PayableAllocationHistoryRow[]
  emptyLabel?: string
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-erp-muted">{emptyLabel}</p>
  }

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
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
              <td className="py-2 pr-3">{row.vendorPaymentNumber ?? '—'}</td>
              <td className="py-2 pr-3">{row.vendorInvoiceNumber ?? row.supplierInvoiceNumber ?? '—'}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(parseDecimal(row.amount))}</td>
              <td className="py-2">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-erp-muted">
        Allocations settle payable open items only. They create no journal entry and cannot be reversed in this phase.
      </p>
    </div>
  )
}
