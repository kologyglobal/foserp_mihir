import { AlertTriangle } from 'lucide-react'
import type { TransferAccountingPreview, TransferAccountingPreviewLine } from '../api/treasury-transfer.types'
import { formatTransferAmount } from '../utils/format'
import { TRANSFER_POSTING_MODE_LABELS } from '../utils/treasuryTransferUi'

function LineTable({ title, lines }: { title: string; lines: TransferAccountingPreviewLine[] }) {
  if (lines.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{title}</p>
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
          {lines.map((line, i) => (
            <tr key={i} className="border-t border-erp-border">
              <td className="px-2 py-1.5">
                {line.accountCode ? `${line.accountCode} — ${line.accountName ?? ''}` : line.accountId.slice(0, 8)}
              </td>
              <td className="px-2 py-1.5 text-erp-muted">{line.accountRole.replace(/_/g, ' ')}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{line.side === 'DEBIT' ? formatTransferAmount(line.amount) : '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{line.side === 'CREDIT' ? formatTransferAmount(line.amount) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Renders the backend-computed accounting preview lines — no client-side GL derivation. */
export function TransferAccountingPreviewPanel({ preview }: { preview: TransferAccountingPreview | null | undefined }) {
  if (!preview) {
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/40 p-4 text-[12px] text-erp-muted">
        No accounting preview yet — validate the transfer to see the GL impact.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-erp-border bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-erp-text">Accounting preview</h3>
        <span className="text-[11px] text-erp-muted">{TRANSFER_POSTING_MODE_LABELS[preview.postingMode]}</span>
      </div>
      <LineTable title="Source side" lines={preview.sourceLines} />
      <LineTable title="Destination side" lines={preview.destinationLines} />
      {preview.warnings.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <ul className="list-inside list-disc space-y-0.5">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
