import { formatCurrency } from '@/utils/formatters/currency'
import { AllocationStatusBadge } from './ReceivableStatusBadge'
import type { AllocationStatus } from '@/types/receivables'

export function ReceiptAllocationSummary({
  receiptAmount,
  tdsDeducted,
  bankCharges,
  availableAmount,
  allocatedAmount,
  unallocatedAmount,
  allocationStatus,
}: {
  receiptAmount: number
  tdsDeducted: number
  bankCharges: number
  availableAmount: number
  allocatedAmount: number
  unallocatedAmount: number
  allocationStatus: AllocationStatus
}) {
  const rows = [
    { label: 'Receipt amount', value: receiptAmount },
    { label: 'TDS deducted', value: -tdsDeducted },
    { label: 'Bank charges', value: -bankCharges },
    { label: 'Available for allocation', value: availableAmount, bold: true },
    { label: 'Allocated', value: allocatedAmount },
    { label: 'Unallocated', value: unallocatedAmount, bold: true },
  ]
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-erp-text">Allocation summary</h3>
        <AllocationStatusBadge status={allocationStatus} />
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
