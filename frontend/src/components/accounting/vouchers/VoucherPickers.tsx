import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { getAccounts } from '@/services/accounting/chartOfAccountsService'
import type { ChartOfAccount } from '@/types/chartOfAccounts'
import { Input } from '@/components/forms/Inputs'
import type { VoucherPartyOption } from '@/types/vouchers'

export function VoucherAccountPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (account: ChartOfAccount) => void
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void getAccounts({ listTab: 'posting', activeStatus: 'Active' })
      .then(setRows)
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows.slice(0, 80)
    return rows
      .filter(
        (a) =>
          a.code.toLowerCase().includes(term) ||
          a.name.toLowerCase().includes(term) ||
          (a.alias ?? '').toLowerCase().includes(term),
      )
      .slice(0, 80)
  }, [q, rows])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="acct-picker-title"
        className="relative z-10 flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-erp-border px-4 py-3">
          <h2 id="acct-picker-title" className="flex-1 text-[15px] font-semibold text-erp-text">
            Select account
          </h2>
          <button type="button" className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-erp-border px-4 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-erp-muted" />
            <Input
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search code or name…"
              autoFocus
            />
          </div>
          <p className="mt-1 text-[11px] text-erp-muted">Posting accounts from Chart of Accounts (demo).</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-[13px] text-erp-muted">Loading accounts…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-[13px] text-erp-muted">No matching posting accounts.</p>
          ) : (
            <ul className="divide-y divide-erp-border/70">
              {filtered.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-erp-surface-alt/60"
                    onClick={() => {
                      onSelect(a)
                      onClose()
                    }}
                  >
                    <span className="w-16 shrink-0 tabular-nums text-[13px] font-semibold">{a.code}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] text-erp-text">{a.name}</span>
                      <span className="text-[11px] text-erp-muted">
                        {a.category} · {a.normalBalance}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function VoucherPartyPickerModal({
  open,
  onClose,
  parties,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  parties: VoucherPartyOption[]
  onSelect: (party: VoucherPartyOption) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return parties
    return parties.filter(
      (p) => p.name.toLowerCase().includes(term) || p.type.includes(term) || (p.gstin ?? '').toLowerCase().includes(term),
    )
  }, [parties, q])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="party-picker-title"
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-erp-border px-4 py-3">
          <h2 id="party-picker-title" className="flex-1 text-[15px] font-semibold">
            Select party
          </h2>
          <button type="button" className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b px-4 py-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search party…" autoFocus />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto divide-y">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-erp-surface-alt/60"
                onClick={() => {
                  onSelect(p)
                  onClose()
                }}
              >
                <span className="text-[13px] font-medium">{p.name}</span>
                <span className="text-[11px] capitalize text-erp-muted">
                  {p.type}
                  {p.gstin ? ` · ${p.gstin}` : ''}
                  {p.city ? ` · ${p.city}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
