import { X } from 'lucide-react'
import type { LedgerAccount, Voucher } from '../../types/accounting'
import { VOUCHER_TYPE_LABELS } from '../../types/accounting'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { AccountingStatusBadge } from './AccountingStatusBadge'

interface PostingPreviewDrawerProps {
  open: boolean
  onClose: () => void
  voucher: Voucher | null
  accounts: LedgerAccount[]
  onConfirmPost?: () => void
  postDisabled?: boolean
  postDisabledReason?: string
}

/** Right-side drawer previewing the G/L debit/credit impact before a voucher is posted. */
export function PostingPreviewDrawer({
  open,
  onClose,
  voucher,
  accounts,
  onConfirmPost,
  postDisabled,
  postDisabledReason,
}: PostingPreviewDrawerProps) {
  if (!open || !voucher) return null
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id
  const accountCode = (id: string) => accounts.find((a) => a.id === id)?.code ?? ''

  return (
    <>
      <div className="erp-right-drawer fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="erp-right-drawer fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-erp-border bg-erp-surface shadow-erp-md">
        <div className="flex shrink-0 items-center justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-erp-text">Posting Preview</h2>
            <p className="mt-0.5 text-xs text-erp-muted">
              {VOUCHER_TYPE_LABELS[voucher.voucherType]} · {voucher.voucherNo}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <AccountingStatusBadge status={voucher.status} />
            <span className="text-[12px] text-erp-muted">{formatDate(voucher.voucherDate)}</span>
          </div>

          <p className="text-[13px] text-erp-text">{voucher.narration}</p>

          <div className="overflow-hidden rounded-md border border-erp-border">
            <table className="erp-table w-full text-[12.5px]">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {voucher.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <p className="font-medium text-erp-text">{accountName(l.accountId)}</p>
                      <p className="font-mono text-[11px] text-erp-muted">{accountCode(l.accountId)}</p>
                      {l.narration ? <p className="text-[11px] text-erp-muted">{l.narration}</p> : null}
                    </td>
                    <td className="text-right tabular-nums">{l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
                    <td className="text-right tabular-nums">{l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td>Total</td>
                  <td className="text-right tabular-nums">{formatCurrency(voucher.totalDebit)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(voucher.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-md bg-erp-surface-alt px-3 py-2 text-[11px] text-erp-muted">
            This is a demo posting preview. Ledger entries are generated locally for reporting only — no backend
            posting engine is involved.
          </div>
        </div>

        <div className="shrink-0 border-t border-erp-border px-5 py-3">
          <ErpButtonGroup className="justify-end">
            <ErpButton type="button" variant="ghost" onClick={onClose}>Close</ErpButton>
            {onConfirmPost ? (
              <ErpButton
                type="button"
                variant="primary"
                disabled={postDisabled}
                disabledReason={postDisabledReason}
                onClick={onConfirmPost}
              >
                Confirm &amp; Post
              </ErpButton>
            ) : null}
          </ErpButtonGroup>
        </div>
      </aside>
    </>
  )
}
