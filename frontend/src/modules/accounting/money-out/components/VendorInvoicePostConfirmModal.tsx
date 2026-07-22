import { ErpButton } from '@/components/erp/ErpButton'
import { formatCurrency } from '@/utils/formatters/currency'
import { parseDecimal } from '../moneyOutUi'

export function VendorInvoicePostConfirmModal({
  open,
  invoiceLabel,
  supplierInvoiceNumber,
  vendorName,
  postingDate,
  grandTotal,
  tdsAmount,
  vendorPayable,
  posting,
  onConfirm,
  onCancel,
}: {
  open: boolean
  invoiceLabel: string
  supplierInvoiceNumber: string
  vendorName: string
  postingDate: string
  grandTotal: string
  tdsAmount: string
  vendorPayable: string
  posting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="vi-post-title">
      <div className="w-full max-w-lg rounded border border-erp-border bg-white p-5 shadow-lg">
        <h2 id="vi-post-title" className="text-[15px] font-semibold text-erp-text">
          Post vendor invoice?
        </h2>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Draft / FOS ref</dt>
            <dd className="font-medium">{invoiceLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Supplier invoice</dt>
            <dd className="font-medium">{supplierInvoiceNumber}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Vendor</dt>
            <dd className="font-medium">{vendorName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Posting date</dt>
            <dd className="tabular-nums">{postingDate}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Invoice total</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(grandTotal))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">TDS</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(tdsAmount))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Vendor payable</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(parseDecimal(vendorPayable))}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-erp-muted">
          Posting creates an accounting voucher, immutable General Ledger entries and a vendor payable open item. The
          document cannot be edited afterward. This does not create or allocate a vendor payment.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onCancel} disabled={posting}>
            Cancel
          </ErpButton>
          <ErpButton variant="primary" onClick={onConfirm} disabled={posting}>
            {posting ? 'Posting…' : 'Post to GL'}
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
