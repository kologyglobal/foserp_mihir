import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import type { MatchPreviewResultDto } from '../api/bank-reconciliation.types'
import { parseDecimal } from '../utils/bankReconciliationUi'

/**
 * Posting-impact preview shown before a match is confirmed.
 * DIRECT / JOURNAL_CREATED_FROM_STATEMENT matches only reconcile subledger positions (no new GL
 * entries) — CLEARING matches post an exact settlement entry between the bank and clearing GL
 * accounts. Surfacing this distinction up-front avoids "why did this post a journal?" surprises.
 */
export function ClearingPreviewPanel({ preview }: { preview: MatchPreviewResultDto }) {
  const isClearing = preview.postingMode === 'CLEARING_SETTLEMENT' && preview.settlementPreview

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="text-erp-muted">Matched amount</p>
          <p className="font-semibold tabular-nums">{formatCurrency(parseDecimal(preview.matchedAmount))}</p>
        </div>
        <div>
          <p className="text-erp-muted">Match source</p>
          <p className="font-semibold">{preview.matchSource.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {isClearing ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> This match will post a clearing settlement entry
          </p>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-amber-800/80">
                <th className="py-1">Account role</th>
                <th className="py-1 text-right">Debit</th>
                <th className="py-1 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {preview.settlementPreview!.map((line, idx) => (
                <tr key={`${line.accountId}-${idx}`} className="border-t border-amber-200/60">
                  <td className="py-1">{line.accountRole === 'BANK' ? 'Bank GL account' : 'Clearing GL account'}</td>
                  <td className="py-1 text-right tabular-nums">
                    {line.side === 'DEBIT' ? formatCurrency(parseDecimal(line.amount)) : '—'}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {line.side === 'CREDIT' ? formatCurrency(parseDecimal(line.amount)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Direct match — no new accounting entries will be created; only subledger positions are marked as reconciled.</span>
        </div>
      )}

      {preview.warnings.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          {preview.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
