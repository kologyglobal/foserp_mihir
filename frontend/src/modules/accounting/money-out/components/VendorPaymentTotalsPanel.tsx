import { formatCurrency } from '@/utils/formatters/currency'
import type { VendorPaymentDto } from '@/types/moneyOut'
import { parseDecimal } from '../moneyOutUi'

/**
 * Vendor payment totals — the three distinct money concepts are kept visually separate:
 *  - Cash paid: paymentAmount (cash actually leaving via bank/cash to the vendor)
 *  - Vendor settlement: vendorSettlementAmount (liability reduced = cash + non-cash adjustments)
 *  - Cash outflow: cashOutflowAmount (total bank/cash credit created on posting)
 * All values are server-authoritative. Nothing is recalculated in the UI.
 */
export function VendorPaymentTotalsPanel({ payment }: { payment: VendorPaymentDto }) {
  const secondary: Array<{ label: string; value: string }> = [
    { label: 'TDS', value: payment.tdsAmount },
    { label: 'Settlement adjustments', value: payment.settlementAdjustmentAmount },
    { label: 'Payment expense (bank/charges)', value: payment.paymentExpenseAmount },
    { label: 'Round-off', value: payment.roundOffAmount },
  ].filter((r) => parseDecimal(r.value) !== 0)

  return (
    <div className="ml-auto w-full max-w-sm rounded border border-erp-border bg-slate-50 p-3">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Payment totals</h3>
      <div className="grid grid-cols-3 gap-2">
        <MoneyTile label="Cash paid" value={payment.paymentAmount} tone="neutral" />
        <MoneyTile label="Settlement" value={payment.vendorSettlementAmount} tone="accent" />
        <MoneyTile label="Cash outflow" value={payment.cashOutflowAmount} tone="strong" />
      </div>
      {secondary.length > 0 && (
        <dl className="mt-3 space-y-1.5 text-[12px]">
          {secondary.map((r) => (
            <div key={r.label} className="flex justify-between gap-4">
              <dt className="text-erp-muted">{r.label}</dt>
              <dd className="tabular-nums text-erp-text">{formatCurrency(parseDecimal(r.value))}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-[11px] text-erp-muted">
        Cash paid is the cash to the vendor. Settlement is the total liability reduced (cash + TDS/discount/retention).
        Cash outflow is the total bank/cash credit. Server-calculated amounts are authoritative.
      </p>
    </div>
  )
}

function MoneyTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'neutral' | 'accent' | 'strong'
}) {
  const toneClass =
    tone === 'strong'
      ? 'text-erp-text font-semibold'
      : tone === 'accent'
        ? 'text-erp-accent font-semibold'
        : 'text-erp-text'
  return (
    <div className="rounded border border-erp-border bg-white p-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-erp-muted">{label}</div>
      <div className={`mt-1 text-[13px] tabular-nums ${toneClass}`}>{formatCurrency(parseDecimal(value))}</div>
    </div>
  )
}
