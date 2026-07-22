import type { TreasuryAdjustmentAccountingPreview, TreasuryAdjustmentLineDto } from '../api/treasury-adjustment.types'
import { formatAdjustmentAmount } from '../utils/format'
import { AdjustmentLinesPanel } from './AdjustmentLinesPanel'

export function AdjustmentAccountingPreviewPanel({
  preview,
  lines,
}: {
  preview?: TreasuryAdjustmentAccountingPreview | null
  lines?: TreasuryAdjustmentLineDto[]
}) {
  if (!preview || preview.lines.length === 0) {
    return (
      <div className="rounded-lg border border-erp-border bg-white p-4">
        {lines && lines.length > 0 ? (
          <div className="mb-4">
            <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Offset lines</h3>
            <AdjustmentLinesPanel lines={lines} />
          </div>
        ) : null}
        <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Accounting preview</h3>
        <p className="text-[13px] text-erp-muted">No accounting preview available yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      {lines && lines.length > 0 ? (
        <div className="mb-4">
          <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Offset lines</h3>
          <AdjustmentLinesPanel lines={lines} />
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-erp-text">Accounting preview</h3>
        <span className={`text-[11px] font-semibold ${preview.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
          {preview.isBalanced ? 'Balanced' : 'Not balanced'}
        </span>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-erp-border text-left text-[11px] font-semibold uppercase text-erp-muted">
            <th className="px-2 py-1.5">Role</th>
            <th className="px-2 py-1.5">Direction</th>
            <th className="px-2 py-1.5 text-right">Amount</th>
            <th className="px-2 py-1.5">Narration</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((line) => (
            <tr key={line.lineNumber} className="border-b border-erp-border/60 last:border-b-0">
              <td className="px-2 py-1.5">{line.role}</td>
              <td className="px-2 py-1.5">{line.direction}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{formatAdjustmentAmount(line.amount)}</td>
              <td className="px-2 py-1.5">{line.lineNarration}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-erp-border font-semibold">
            <td className="px-2 py-1.5" colSpan={2}>
              Total
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              Dr {formatAdjustmentAmount(preview.totalDebit)} / Cr {formatAdjustmentAmount(preview.totalCredit)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
