import { formatCurrency } from '@/utils/formatters/currency'
import { PaymentAllocationStatusBadge } from './PayableStatusBadge'
import type { PaymentAllocationStatus } from '@/types/payables'

export function PaymentAllocationSummary({
  paymentAmount,
  tdsDeducted,
  availableAmount,
  allocatedAmount,
  unallocatedAmount,
  allocationStatus,
}: {
  paymentAmount: number
  tdsDeducted: number
  availableAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: PaymentAllocationStatus
}) {
  const rows = [
    { label: 'Payment amount', value: paymentAmount },
    { label: 'TDS deducted', value: -tdsDeducted },
    { label: 'Available for allocation', value: availableAmount, bold: true },
    { label: 'Allocated', value: allocatedAmount },
    { label: 'Unallocated', value: unallocatedAmount, bold: true },
  ]
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-erp-text">Allocation summary</h3>
        <PaymentAllocationStatusBadge status={allocationStatus} />
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{r.label}</dt>
            <dd className={`mt-0.5 tabular-nums text-[13px] ${r.bold ? 'font-semibold text-erp-text' : 'text-erp-text'}`}>
              {formatCurrency(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
