import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import type { BookResultDto } from '../api/treasury-books.types'
import { formatBookAmount, formatBookDate } from '../utils/format'

export function BookTable({ result }: { result: BookResultDto }) {
  if (result.entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
        <p className="text-[13px] text-erp-muted">No entries in the selected date range.</p>
      </div>
    )
  }

  return (
    <div className="hidden md:block">
      <EnterpriseRegisterTableShell>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">Voucher</th>
              <th className="px-2 py-1.5">Source</th>
              <th className="px-2 py-1.5">Narration</th>
              <th className="px-2 py-1.5 text-right">Debit</th>
              <th className="px-2 py-1.5 text-right">Credit</th>
              <th className="px-2 py-1.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-erp-border bg-erp-surface-alt/40">
              <td className="px-2 py-1.5" colSpan={6}>
                Opening balance
              </td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatBookAmount(result.openingBalance)}</td>
            </tr>
            {result.entries.map((entry) => (
              <tr key={entry.entryId} className="border-t border-erp-border hover:bg-erp-surface/40">
                <td className="px-2 py-1.5 whitespace-nowrap">{formatBookDate(entry.postingDate)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {entry.voucherType} {entry.voucherNumber}
                </td>
                <td className="px-2 py-1.5 text-erp-muted">{entry.sourceModule ?? '—'}</td>
                <td className="px-2 py-1.5">{entry.narration ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {Number(entry.debitAmount) > 0 ? formatBookAmount(entry.debitAmount) : '—'}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {Number(entry.creditAmount) > 0 ? formatBookAmount(entry.creditAmount) : '—'}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatBookAmount(entry.runningBalance)}</td>
              </tr>
            ))}
            <tr className="border-t border-erp-border bg-erp-surface-alt/40">
              <td className="px-2 py-1.5" colSpan={6}>
                Closing balance
              </td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatBookAmount(result.closingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </EnterpriseRegisterTableShell>
    </div>
  )
}
