import { AlertTriangle } from 'lucide-react'
import type { ChequeAccountingLine, ChequeAccountingPreview } from '../api/treasury-cheque.types'
import { formatChequeAmount } from '../utils/format'

const STEP_LABELS: Record<ChequeAccountingPreview['step'], string> = {
  ISSUE: 'On issue',
  DEPOSIT: 'On deposit',
}

function LineRow({ line }: { line: ChequeAccountingLine }) {
  return (
    <tr className="border-t border-erp-border">
      <td className="px-2 py-1.5">{line.accountCode ? `${line.accountCode} — ${line.accountName ?? ''}` : line.accountId.slice(0, 8)}</td>
      <td className="px-2 py-1.5 text-erp-muted">{line.role === 'BANK' ? 'Bank' : 'Counterpart'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{line.direction === 'DEBIT' ? formatChequeAmount(line.amount) : '—'}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{line.direction === 'CREDIT' ? formatChequeAmount(line.amount) : '—'}</td>
    </tr>
  )
}

/** Renders the backend-computed accounting preview lines — no client-side GL derivation. */
export function ChequeAccountingPreviewPanel({ preview }: { preview: ChequeAccountingPreview | null | undefined }) {
  if (!preview || preview.lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-4 text-[12px] text-erp-muted">
        No accounting preview yet — validate the cheque to see the GL impact.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-erp-border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-erp-text">Accounting preview</h3>
        <span className="text-[11px] text-erp-muted">{STEP_LABELS[preview.step]}</span>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
            <th className="px-2 py-1">Account</th>
            <th className="px-2 py-1">Role</th>
            <th className="px-2 py-1 text-right">Debit</th>
            <th className="px-2 py-1 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((line) => (
            <LineRow key={line.lineNumber} line={line} />
          ))}
        </tbody>
      </table>
      {!preview.isBalanced ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Preview is not balanced yet — resolve the counterpart account and validate again.</span>
        </div>
      ) : null}
    </div>
  )
}
