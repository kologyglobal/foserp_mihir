import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { ScoredLedgerCandidateDto } from '../api/bank-reconciliation.types'
import { ConfidenceChip } from './BankReconciliationStatusChip'
import { parseDecimal } from '../utils/bankReconciliationUi'

export interface CandidateTableProps {
  title: string
  candidates: ScoredLedgerCandidateDto[]
  selected: Map<string, string>
  onToggle: (candidate: ScoredLedgerCandidateDto) => void
  onAmountChange: (generalLedgerEntryId: string, amount: string) => void
  emptyMessage?: string
}

/** Ledger candidate picker used in the manual/grouped match drawer — one pool (direct or clearing) at a time. */
export function CandidateTable({ title, candidates, selected, onToggle, onAmountChange, emptyMessage }: CandidateTableProps) {
  if (candidates.length === 0) {
    return (
      <div>
        <h4 className="mb-1 text-[12px] font-semibold text-erp-text">{title}</h4>
        <p className="text-[12px] text-erp-muted">{emptyMessage ?? 'No candidates found.'}</p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="mb-1 text-[12px] font-semibold text-erp-text">{title}</h4>
      <div className="overflow-auto rounded-lg border border-erp-border">
        <table className="w-full min-w-[42rem] text-[12px]">
          <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
            <tr>
              <th className="w-8 px-2 py-1.5" />
              <th className="px-2 py-1.5">Voucher</th>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">Party / Narration</th>
              <th className="px-2 py-1.5 text-right">Unreconciled</th>
              <th className="px-2 py-1.5 text-right">Allocate</th>
              <th className="px-2 py-1.5">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => {
              const isSelected = selected.has(c.generalLedgerEntryId)
              const amount = selected.get(c.generalLedgerEntryId) ?? c.unreconciledAmount
              return (
                <tr key={c.generalLedgerEntryId} className="border-t border-erp-border">
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ledger entry ${c.voucherNumber}`}
                      checked={isSelected}
                      onChange={() => onToggle(c)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <p className="font-medium text-erp-text">{c.voucherNumber}</p>
                    <p className="text-[11px] text-erp-muted">{c.voucherType}</p>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(c.postingDate)}</td>
                  <td className="max-w-[14rem] truncate px-2 py-1.5" title={c.narration ?? undefined}>
                    {c.partyNameSnapshot ?? c.narration ?? c.referenceNumber ?? '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(parseDecimal(c.unreconciledAmount))}</td>
                  <td className="px-2 py-1.5 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!isSelected}
                      value={amount}
                      onChange={(e) => onAmountChange(c.generalLedgerEntryId, e.target.value)}
                      className="h-7 w-24 rounded border border-erp-border px-1.5 text-right text-[12px] tabular-nums disabled:bg-erp-surface/60"
                      aria-label={`Allocation amount for ${c.voucherNumber}`}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <ConfidenceChip level={c.confidenceLevel} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
