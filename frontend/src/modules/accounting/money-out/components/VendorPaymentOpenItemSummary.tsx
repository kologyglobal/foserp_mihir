import { formatCurrency } from '@/utils/formatters/currency'
import type { VendorPaymentDto } from '@/types/moneyOut'
import { PAYMENT_ALLOCATION_STATE_LABELS, parseDecimal } from '../moneyOutUi'

/** Read-only DEBIT payable open item created on posting + its allocation utilisation state. */
export function VendorPaymentOpenItemSummary({ payment }: { payment: VendorPaymentDto }) {
  if (payment.status !== 'POSTED') {
    return (
      <p className="text-[12px] text-erp-muted">
        Accounting entries and the payment open item will appear after posting.
      </p>
    )
  }

  const allocated = parseDecimal(payment.payableAllocatedAmount ?? '0')
  const outstanding = parseDecimal(payment.payableOutstandingAmount ?? payment.vendorSettlementAmount)

  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
        Payment open item (DEBIT)
      </h3>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-erp-muted">Document</dt>
          <dd className="font-medium">{payment.vendorPaymentNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Type</dt>
          <dd className="font-medium">
            {payment.payableOpenItemDocumentType === 'VENDOR_ADVANCE' ? 'Vendor advance' : 'Vendor payment'}
          </dd>
        </div>
        <div>
          <dt className="text-erp-muted">Original</dt>
          <dd className="tabular-nums">
            {formatCurrency(parseDecimal(payment.payableOriginalAmount ?? payment.vendorSettlementAmount))}
          </dd>
        </div>
        <div>
          <dt className="text-erp-muted">Allocated</dt>
          <dd className="tabular-nums">{formatCurrency(allocated)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Unallocated (remaining)</dt>
          <dd className="tabular-nums font-semibold">{formatCurrency(outstanding)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Allocation state</dt>
          <dd className="font-medium">
            {payment.allocationState ? PAYMENT_ALLOCATION_STATE_LABELS[payment.allocationState] : '—'}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-erp-muted">
        Allocating this payment against posted invoices reduces open-item balances only — it creates no journal entry.
      </p>
    </div>
  )
}
