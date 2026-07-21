import { formatCurrency } from '@/utils/formatters/currency'
import { parseDecimal } from '../moneyOutUi'

export function VendorInvoiceTotalsPanel({
  taxable,
  cgst,
  sgst,
  igst,
  cess,
  nonRecoverable,
  freight,
  other,
  roundOff,
  grandTotal,
  tds,
  vendorPayable,
}: {
  taxable: string
  cgst: string
  sgst: string
  igst: string
  cess?: string
  nonRecoverable?: string
  freight?: string
  other?: string
  roundOff?: string
  grandTotal: string
  tds?: string
  vendorPayable: string
}) {
  const rows: Array<{ label: string; value: string; emphasize?: boolean }> = [
    { label: 'Taxable', value: taxable },
    { label: 'Input CGST', value: cgst },
    { label: 'Input SGST', value: sgst },
    { label: 'Input IGST', value: igst },
  ]
  if (cess && parseDecimal(cess) !== 0) rows.push({ label: 'Input Cess', value: cess })
  if (nonRecoverable && parseDecimal(nonRecoverable) !== 0) {
    rows.push({ label: 'Non-recoverable tax', value: nonRecoverable })
  }
  if (freight && parseDecimal(freight) !== 0) rows.push({ label: 'Freight', value: freight })
  if (other && parseDecimal(other) !== 0) rows.push({ label: 'Other charges', value: other })
  if (roundOff && parseDecimal(roundOff) !== 0) rows.push({ label: 'Round-off', value: roundOff })
  rows.push({ label: 'Invoice total', value: grandTotal, emphasize: true })
  if (tds && parseDecimal(tds) !== 0) rows.push({ label: 'TDS', value: tds })
  rows.push({ label: 'Vendor payable', value: vendorPayable, emphasize: true })

  return (
    <div className="ml-auto w-full max-w-sm rounded border border-erp-border bg-slate-50 p-3">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Totals</h3>
      <dl className="space-y-1.5 text-[12px]">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <dt className={r.emphasize ? 'font-semibold text-erp-text' : 'text-erp-muted'}>{r.label}</dt>
            <dd className={`tabular-nums ${r.emphasize ? 'font-semibold text-erp-text' : 'text-erp-text'}`}>
              {formatCurrency(parseDecimal(r.value))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-erp-muted">
        Server-calculated amounts are authoritative. TDS is not a cash payment.
      </p>
    </div>
  )
}
