import { ErpButton } from '@/components/erp/ErpButton'
import { formatCurrency } from '@/utils/formatters/currency'
import { PAYMENT_PURPOSE_LABELS, parseDecimal } from '../moneyOutUi'
import type { VendorPaymentPurpose } from '@/types/moneyOut'

export function VendorPaymentPostConfirmModal({
  open,
  paymentLabel,
  vendorName,
  paymentPurpose,
  postingDate,
  cashPaid,
  settlement,
  cashOutflow,
  tdsAmount,
  posting,
  onConfirm,
  onCancel,
}: {
  open: boolean
  paymentLabel: string
  vendorName: string
  paymentPurpose: VendorPaymentPurpose
  postingDate: string
  cashPaid: string
  settlement: string
  cashOutflow: string
  tdsAmount: string
  posting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-post-title"
    >
      <div className="w-full max-w-lg rounded border border-erp-border bg-white p-5 shadow-lg">
        <h2 id="vp-post-title" className="text-[15px] font-semibold text-erp-text">
          Post vendor payment?
        </h2>
        <dl className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Draft / FOS ref</dt>
            <dd className="font-medium">{paymentLabel}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Vendor</dt>
            <dd className="font-medium">{vendorName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Purpose</dt>
            <dd>{PAYMENT_PURPOSE_LABELS[paymentPurpose]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Posting date</dt>
            <dd className="tabular-nums">{postingDate}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Cash paid</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(cashPaid))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">TDS</dt>
            <dd className="tabular-nums">{formatCurrency(parseDecimal(tdsAmount))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Vendor settlement</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(parseDecimal(settlement))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-erp-muted">Cash outflow</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(parseDecimal(cashOutflow))}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[12px] text-erp-muted">
          Posting creates an accounting voucher, immutable General Ledger entries and a DEBIT payable open item. The
          document cannot be edited afterward. Allocation against invoices happens separately and creates no GL.
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
