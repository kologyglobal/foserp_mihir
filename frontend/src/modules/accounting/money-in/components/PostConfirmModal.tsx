import { ErpButton } from '@/components/erp/ErpButton'

export function PostConfirmModal({
  open,
  invoiceLabel,
  totalAmount,
  posting,
  onConfirm,
  onCancel,
}: {
  open: boolean
  invoiceLabel: string
  totalAmount: string
  posting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded border border-erp-border bg-white p-5 shadow-lg">
        <h2 className="text-[15px] font-semibold text-erp-text">Post sales invoice?</h2>
        <p className="mt-2 text-[13px] text-erp-muted">
          Posting <strong>{invoiceLabel}</strong> for <strong>₹{Number(totalAmount).toLocaleString('en-IN')}</strong> will create a
          system voucher, GL entries, and a receivable open item. This action cannot be undone from Money In.
        </p>
        <p className="mt-2 text-[12px] text-erp-muted">Receipt allocation and credit notes are Phase 3B — not available here.</p>
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
