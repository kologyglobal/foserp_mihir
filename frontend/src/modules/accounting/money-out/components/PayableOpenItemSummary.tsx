import { formatCurrency } from '@/utils/formatters/currency'
import type { VendorInvoiceDto } from '@/types/moneyOut'
import { parseDecimal } from '../moneyOutUi'

export function PayableOpenItemSummary({ invoice }: { invoice: VendorInvoiceDto }) {
  if (invoice.status !== 'POSTED') {
    return (
      <p className="text-[12px] text-erp-muted">Accounting entries and payable open item will appear after posting.</p>
    )
  }

  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Vendor payable open item</h3>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-erp-muted">Document</dt>
          <dd className="font-medium">{invoice.vendorInvoiceNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Status</dt>
          <dd className="font-medium">{invoice.payableOpenItemStatus ?? 'OPEN'}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Original payable</dt>
          <dd className="tabular-nums">{formatCurrency(parseDecimal(invoice.payableOriginalAmount ?? invoice.vendorPayableAmount))}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Outstanding</dt>
          <dd className="tabular-nums font-semibold">
            {formatCurrency(parseDecimal(invoice.payableOutstandingAmount ?? invoice.vendorPayableAmount))}
          </dd>
        </div>
        <div>
          <dt className="text-erp-muted">Allocated</dt>
          <dd className="tabular-nums">{formatCurrency(0)}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Due date</dt>
          <dd className="tabular-nums">{invoice.dueDate ?? '—'}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-erp-muted">
        Payment and allocation will be available in the Vendor Payments phase. No payment was created by posting.
      </p>
    </div>
  )
}
