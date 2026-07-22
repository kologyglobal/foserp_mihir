import { formatCurrency } from '@/utils/formatters/currency'
import type { VendorPaymentPositionResult } from '@/types/moneyOut'
import { PAYMENT_PURPOSE_LABELS, parseDecimal } from '../moneyOutUi'

/** Read-only vendor position snapshot from the calculation engine (validation.paymentPosition). */
export function VendorPaymentPositionPanel({
  position,
}: {
  position: VendorPaymentPositionResult | null | undefined
}) {
  if (!position) {
    return (
      <p className="text-[12px] text-erp-muted">
        The vendor position appears after saving or validating the payment.
      </p>
    )
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Outstanding invoices (credit)', value: position.vendorCreditOutstanding },
    { label: 'Outstanding advances/payments (debit)', value: position.vendorDebitOutstanding },
    { label: 'Net vendor payable', value: position.netVendorPayable },
    { label: 'Proposed settlement', value: position.proposedVendorSettlementAmount },
  ]
  const excess = parseDecimal(position.excessSettlementAmount)

  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Vendor position</h3>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className="text-erp-muted">{r.label}</dt>
            <dd className="tabular-nums text-erp-text">{formatCurrency(parseDecimal(r.value))}</dd>
          </div>
        ))}
      </dl>
      {!position.purposeConsistent && position.suggestedPurpose && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          The payment amount suggests a {PAYMENT_PURPOSE_LABELS[position.suggestedPurpose]} purpose. Review the selected
          purpose before posting.
        </p>
      )}
      {excess > 0 && (
        <p className="mt-2 text-[11px] text-erp-muted">
          Excess over current invoices: {formatCurrency(excess)} — will remain as an advance/on-account balance.
        </p>
      )}
    </div>
  )
}
