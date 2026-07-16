import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { PayableDrawerShell } from './PayableDrawerShell'
import { VendorPaymentStatusBadge } from './PayableStatusBadge'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { getVendorPaymentById, PayablesServiceError } from '@/services/accounting/payablesService'
import type { VendorPayment } from '@/types/payables'
import { LoadingState } from '@/design-system/components/LoadingState'

export function PaymentAdvicePreview({
  open,
  onClose,
  paymentId,
  payment: presetPayment,
}: {
  open: boolean
  onClose: () => void
  paymentId?: string
  payment?: VendorPayment | null
}) {
  const [payment, setPayment] = useState<VendorPayment | null>(presetPayment ?? null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setPayment(presetPayment ?? null)
      return
    }
    if (presetPayment) {
      setPayment(presetPayment)
      return
    }
    if (!paymentId) {
      setPayment(null)
      return
    }
    setLoading(true)
    void getVendorPaymentById(paymentId)
      .then(setPayment)
      .catch((e) => {
        setPayment(null)
        notify.error(e instanceof PayablesServiceError ? e.message : 'Payment advice could not be loaded.')
      })
      .finally(() => setLoading(false))
  }, [open, paymentId, presetPayment])

  return (
    <PayableDrawerShell
      open={open}
      onClose={onClose}
      title="Payment advice preview"
      subtitle={payment ? `${payment.paymentNumber} · ${payment.vendorName}` : undefined}
      eyebrow="Payables · Payments"
      widthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold"
            onClick={() => notify.info('Email preview only — no payment advice was sent (demo).')}
          >
            <Mail className="mr-1 inline h-4 w-4" aria-hidden />
            Email preview
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
            onClick={() => notify.info('Print/export integration is not connected (demo).')}
          >
            Print / Export
          </button>
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="table" rows={4} />
      ) : !payment ? (
        <p className="py-8 text-center text-[13px] text-erp-muted">No payment selected.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <VendorPaymentStatusBadge status={payment.status} />
            <span className="text-[12px] text-erp-muted">{payment.paymentMode}</span>
          </div>

          <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4 text-[13px]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Payment advice</p>
            <p className="mt-2 font-semibold text-erp-text">Dear {payment.vendorName},</p>
            <p className="mt-2 text-erp-text">
              We confirm a payment of <strong>{formatCurrency(payment.amount)}</strong> dated{' '}
              <strong>{formatDate(payment.paymentDate)}</strong> via {payment.paymentMode}.
            </p>
            {payment.transactionReference ? (
              <p className="mt-1 text-erp-muted">Reference: {payment.transactionReference}</p>
            ) : null}
            {payment.chequeNumber ? (
              <p className="mt-1 text-erp-muted">
                Cheque {payment.chequeNumber}
                {payment.chequeDate ? ` dated ${formatDate(payment.chequeDate)}` : ''}
              </p>
            ) : null}
            <p className="mt-2 text-erp-muted">Bank account: {payment.bankAccountName}</p>
            {payment.tdsDeducted > 0 ? (
              <p className="mt-1 text-erp-muted">TDS deducted: {formatCurrency(payment.tdsDeducted)}</p>
            ) : null}
            {payment.narration ? <p className="mt-2 text-erp-text">{payment.narration}</p> : null}
          </div>

          {payment.allocationLines.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th className="text-right">Allocated</th>
                  </tr>
                </thead>
                <tbody>
                  {payment.allocationLines.map((line) => (
                    <tr key={line.id}>
                      <td className="font-mono">{line.invoiceNumber}</td>
                      <td className="text-right tabular-nums">{formatCurrency(line.allocationAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-[11px] text-erp-muted">
            Demo preview — email button shows a notification only. No payment advice is delivered to the vendor.
          </p>
        </div>
      )}
    </PayableDrawerShell>
  )
}
