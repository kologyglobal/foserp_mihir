import { formatCurrency } from '@/utils/formatters/currency'
import { parseDecimal } from '../moneyInUi'

export function TotalsPanel({
  subtotal,
  discount,
  taxable,
  cgst,
  sgst,
  igst,
  freight,
  other,
  roundOff,
  total,
  preview,
}: {
  subtotal?: string
  discount?: string
  taxable?: string
  cgst?: string
  sgst?: string
  igst?: string
  freight?: string
  other?: string
  roundOff?: string
  total?: string
  preview?: boolean
}) {
  const rows = [
    { label: 'Subtotal', value: subtotal },
    { label: 'Discount', value: discount },
    { label: 'Taxable', value: taxable },
    { label: 'CGST', value: cgst },
    { label: 'SGST', value: sgst },
    { label: 'IGST', value: igst },
    { label: 'Freight', value: freight },
    { label: 'Other charges', value: other },
    { label: 'Round off', value: roundOff },
  ].filter((r) => r.value !== undefined)

  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Totals</h3>
        {preview && <span className="text-[11px] text-amber-700">Client preview — save for server totals</span>}
      </div>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-[12px]">
            <dt className="text-erp-muted">{r.label}</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(parseDecimal(r.value))}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-erp-border pt-2 text-[13px] font-semibold">
          <dt>Invoice total</dt>
          <dd className="tabular-nums text-erp-text">{formatCurrency(parseDecimal(total))}</dd>
        </div>
      </dl>
    </div>
  )
}
