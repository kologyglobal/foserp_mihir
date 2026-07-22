import type { TreasuryAdjustmentLineDto } from '../api/treasury-adjustment.types'
import { formatAdjustmentAmount } from '../utils/format'

export function AdjustmentLinesPanel({ lines }: { lines: TreasuryAdjustmentLineDto[] }) {
  if (lines.length === 0) {
    return <p className="text-[13px] text-erp-muted">No offset lines.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-erp-border text-left text-[11px] font-semibold uppercase text-erp-muted">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Line Type</th>
            <th className="px-2 py-2">GL Account</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2 text-right">Amount</th>
            <th className="px-2 py-2">Side</th>
            <th className="px-2 py-2">GST</th>
            <th className="px-2 py-2">TDS</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-erp-border/60 last:border-b-0">
              <td className="px-2 py-2 text-erp-muted">{line.lineNumber}</td>
              <td className="px-2 py-2">{line.lineType}</td>
              <td className="px-2 py-2">
                {line.accountCode ? `${line.accountCode} â€” ${line.accountName ?? ''}` : 'â€”'}
                {line.isSystemGenerated ? <span className="ml-1 rounded bg-erp-surface px-1 text-[10px] text-erp-muted">system</span> : null}
              </td>
              <td className="px-2 py-2">{line.description ?? 'â€”'}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold">{formatAdjustmentAmount(line.amount)}</td>
              <td className="px-2 py-2">{line.side}</td>
              <td className="px-2 py-2">
                {line.gstTreatment !== 'GST_NOT_APPLICABLE' ? (
                  <span>
                    {line.gstTreatment}
                    {line.gstAmount ? ` (${formatAdjustmentAmount(line.gstAmount)})` : ''}
                  </span>
                ) : (
                  'â€”'
                )}
              </td>
              <td className="px-2 py-2">
                {line.tdsTreatment !== 'TDS_NOT_APPLICABLE' ? (
                  <span>
                    {line.tdsTreatment}
                    {line.tdsAmount ? ` (${formatAdjustmentAmount(line.tdsAmount)})` : ''}
                  </span>
                ) : (
                  'â€”'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
