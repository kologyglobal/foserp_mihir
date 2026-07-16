import type { MovementAccountingPreview, MovementAuditEntry, MovementCostPreview } from '@/types/inventoryDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'

export function MovementCostPreviewPanel({ preview, title = 'Cost Preview' }: { preview: MovementCostPreview | null; title?: string }) {
  if (!preview) return null
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface p-4">
      <h3 className="text-[13px] font-semibold text-erp-text">{title}</h3>
      <table className="erp-table mt-3 w-full text-[12px]">
        <thead>
          <tr>
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {preview.lines.map((l) => (
            <tr key={l.itemCode}>
              <td className="font-mono">{l.itemCode}</td>
              <td className="num">{l.qty}</td>
              <td className="num">{formatCurrency(l.rate)}</td>
              <td className="num">{formatCurrency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="text-right font-medium">Total</td>
            <td className="num font-semibold">{formatCurrency(preview.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function MovementAccountingPreviewPanel({
  preview,
  title = 'Accounting Preview',
}: {
  preview: MovementAccountingPreview | null
  title?: string
}) {
  if (!preview) return null
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface p-4">
      <h3 className="text-[13px] font-semibold text-erp-text">{title}</h3>
      <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-erp-muted">Debit</dt>
          <dd className="font-medium text-erp-text">{preview.debitAccount}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Credit</dt>
          <dd className="font-medium text-erp-text">{preview.creditAccount}</dd>
        </div>
        <div>
          <dt className="text-erp-muted">Amount</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(preview.amount)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-erp-muted">Narration</dt>
          <dd className="text-erp-text">{preview.narration}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-amber-700">Demo preview only — no live GL posting.</p>
    </div>
  )
}

export function MovementAuditTimeline({ entries }: { entries: MovementAuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-erp-muted">No audit history.</p>
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li key={e.id} className="rounded border border-erp-border px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-erp-text">{e.action}</span>
            <span className="text-erp-muted">{formatDateTime(e.timestamp)}</span>
          </div>
          <p className="mt-1 text-erp-muted">{e.userName}{e.remarks ? ` — ${e.remarks}` : ''}</p>
        </li>
      ))}
    </ul>
  )
}

interface TabDef {
  id: string
  label: string
}

export function MovementRegisterTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly TabDef[]
  activeTab: string
  onChange: (tabId: string) => void
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border pb-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeTab === t.id
              ? 'bg-erp-primary text-white'
              : 'text-erp-muted hover:bg-erp-surface-2 hover:text-erp-text'
          }`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
