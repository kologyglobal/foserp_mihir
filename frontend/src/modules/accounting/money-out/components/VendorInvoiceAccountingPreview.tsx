import { formatCurrency } from '@/utils/formatters/currency'
import type { VendorInvoiceAccountingPreview } from '@/types/moneyOut'
import { parseDecimal } from '../moneyOutUi'

export function VendorInvoiceAccountingPreviewTable({ preview }: { preview: VendorInvoiceAccountingPreview | null | undefined }) {
  if (!preview) {
    return <p className="text-[12px] text-erp-muted">Accounting preview will appear after validation or save.</p>
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[12px]">
        <span className={preview.isBalanced ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'}>
          {preview.isBalanced ? 'Balanced' : 'Unbalanced'}
        </span>
        <span className="text-erp-muted">Vendor payable credit: {formatCurrency(parseDecimal(preview.vendorPayableCreditAmount))}</span>
      </div>
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-erp-border text-erp-muted">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Account</th>
            <th className="py-2 pr-2">Narration</th>
            <th className="py-2 pr-2 text-right">Debit</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((l) => (
            <tr key={l.lineNumber} className="border-b border-erp-border/60">
              <td className="py-2 pr-2">{l.lineNumber}</td>
              <td className="py-2 pr-2">
                <div className="font-medium">{l.accountCode ?? '—'}</div>
                <div className="text-erp-muted">{l.accountName ?? l.component}</div>
              </td>
              <td className="py-2 pr-2">{l.description}</td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {parseDecimal(l.debitAmount) > 0 ? formatCurrency(parseDecimal(l.debitAmount)) : '—'}
              </td>
              <td className="py-2 text-right tabular-nums">
                {parseDecimal(l.creditAmount) > 0 ? formatCurrency(parseDecimal(l.creditAmount)) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-erp-border font-semibold">
            <td colSpan={3} className="py-2 pr-2">
              Totals
            </td>
            <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(preview.totalDebit))}</td>
            <td className="py-2 text-right tabular-nums">{formatCurrency(parseDecimal(preview.totalCredit))}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[11px] text-erp-muted">Preview is server-built. Posting uses the same formula as this preview.</p>
    </div>
  )
}
