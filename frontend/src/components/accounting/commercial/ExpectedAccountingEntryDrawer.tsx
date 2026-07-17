import { X } from 'lucide-react'
import { CommercialAccountingExplanation } from './CommercialBadges'

/** Informational only — never posts to GL. */
export function ExpectedAccountingEntryDrawer({
  open,
  onClose,
  documentLabel,
  showIllustrativeAmounts,
}: {
  open: boolean
  onClose: () => void
  documentLabel?: string
  showIllustrativeAmounts?: boolean
}) {
  if (!open) return null
  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="erp-modal-panel ml-auto flex h-full max-w-md flex-col rounded-none border-l border-erp-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-erp-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-erp-text">Expected Accounting Entry</h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">No accounting entry has been posted.</p>
            {documentLabel ? <p className="mt-1 text-[12px] text-erp-text">{documentLabel}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="text-erp-muted hover:text-erp-text" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <CommercialAccountingExplanation />
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
            Illustrative future Sales Invoice
          </p>
          <table className="w-full text-left text-[12px]">
            <thead className="text-[10px] uppercase text-erp-muted">
              <tr>
                <th className="py-1">Account</th>
                <th className="py-1 text-right">Debit</th>
                <th className="py-1 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-erp-border">
                <td className="py-1.5">Customer Receivable</td>
                <td className="py-1.5 text-right">{showIllustrativeAmounts ? 'Illustrative' : '—'}</td>
                <td className="py-1.5 text-right">—</td>
              </tr>
              <tr className="border-t border-erp-border">
                <td className="py-1.5">Sales Revenue</td>
                <td className="py-1.5 text-right">—</td>
                <td className="py-1.5 text-right">{showIllustrativeAmounts ? 'Illustrative' : '—'}</td>
              </tr>
              <tr className="border-t border-erp-border">
                <td className="py-1.5">Output CGST / SGST / IGST</td>
                <td className="py-1.5 text-right">—</td>
                <td className="py-1.5 text-right">{showIllustrativeAmounts ? 'Illustrative' : '—'}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-erp-muted">
            Illustrative values only. Not saved to General Ledger, Trial Balance, P&amp;L, ageing, or GST register.
          </p>
        </div>
      </div>
    </div>
  )
}
