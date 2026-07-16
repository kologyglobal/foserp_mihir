import { Eye, MoreHorizontal, Pencil, Send } from 'lucide-react'
import { TableLink } from '@/components/ui/AppLink'
import { formatCurrency } from '@/utils/formatters/currency'
import type { AccountingVoucher } from '@/types/vouchers'
import { VOUCHER_DOCUMENT_TYPE_LABELS } from '@/types/vouchers'
import { VoucherStatusBadge } from './VoucherBadges'
import { canEditVoucher, canSubmitVoucher } from './voucherStatusRules'

export type VoucherListAction = 'view' | 'edit' | 'submit' | 'approve' | 'post' | 'reverse' | 'more'

export function VoucherRegisterTable({
  rows,
  onAction,
  canEdit,
  canSubmit,
}: {
  rows: AccountingVoucher[]
  onAction: (action: VoucherListAction, voucher: AccountingVoucher) => void
  canEdit: boolean
  canSubmit: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="erp-table w-full min-w-[960px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
            <th className="px-3 py-2 font-semibold">Voucher No</th>
            <th className="px-3 py-2 font-semibold">Type</th>
            <th className="px-3 py-2 font-semibold">Date</th>
            <th className="px-3 py-2 font-semibold">Party</th>
            <th className="px-3 py-2 font-semibold">Narration</th>
            <th className="px-3 py-2 text-right font-semibold">Debit</th>
            <th className="px-3 py-2 text-right font-semibold">Credit</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold">Created By</th>
            <th className="px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
              <td className="px-3 py-2">
                <TableLink to={`/accounting/vouchers/${v.id}`}>{v.voucherNumber}</TableLink>
                {!v.isBalanced ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase text-amber-700">Unbal</span>
                ) : null}
              </td>
              <td className="px-3 py-2">{VOUCHER_DOCUMENT_TYPE_LABELS[v.voucherType]}</td>
              <td className="px-3 py-2 tabular-nums">{v.voucherDate}</td>
              <td className="px-3 py-2">{v.partyName ?? '—'}</td>
              <td className="max-w-[220px] truncate px-3 py-2 text-erp-muted" title={v.narration}>
                {v.narration}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.totalDebit)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.totalCredit)}</td>
              <td className="px-3 py-2">
                <VoucherStatusBadge status={v.status} />
              </td>
              <td className="px-3 py-2 text-erp-muted">{v.createdBy}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                    title="View"
                    aria-label={`View ${v.voucherNumber}`}
                    onClick={() => onAction('view', v)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {canEdit && canEditVoucher(v.status) ? (
                    <button
                      type="button"
                      className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                      title="Edit"
                      aria-label={`Edit ${v.voucherNumber}`}
                      onClick={() => onAction('edit', v)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : null}
                  {canSubmit && canSubmitVoucher(v.status) && v.isBalanced ? (
                    <button
                      type="button"
                      className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                      title="Submit"
                      aria-label={`Submit ${v.voucherNumber}`}
                      onClick={() => onAction('submit', v)}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
                    title="More"
                    aria-label={`More actions for ${v.voucherNumber}`}
                    onClick={() => onAction('more', v)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
