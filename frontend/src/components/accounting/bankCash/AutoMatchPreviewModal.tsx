import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wand2, X } from 'lucide-react'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'
import type { AutoMatchPreview, Reconciliation } from '@/types/bankCash'
import { applyMatchesDemo, BankCashServiceError, getAutoMatchPreview } from '@/services/accounting/bankCashService'
import { notify } from '@/store/toastStore'
import { MatchConfidenceBadge } from './BankCashStatusBadge'

/**
 * Auto-match preview — suggests statement-to-book matches by confidence.
 * High confidence rows are pre-selected; Medium require manual review; Low is NEVER auto-applied.
 */
export function AutoMatchPreviewModal({
  open,
  onClose,
  reconciliationId,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  reconciliationId: string
  onApplied: (reconciliation: Reconciliation) => void
}) {
  const [preview, setPreview] = useState<AutoMatchPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !reconciliationId) {
      setPreview(null)
      setSelected(new Set())
      return
    }
    setLoading(true)
    void getAutoMatchPreview(reconciliationId)
      .then((p) => {
        setPreview(p)
        // Pre-select High only — never Low, never Medium by default
        setSelected(new Set(p.suggestedMatches.filter((m) => m.confidence === 'High').map((m) => m.matchId)))
      })
      .catch((e) => {
        setPreview(null)
        notify.error(e instanceof BankCashServiceError ? e.message : 'Failed to load auto-match preview.')
      })
      .finally(() => setLoading(false))
  }, [open, reconciliationId])

  if (!open) return null

  const toggle = (matchId: string, confidence: AutoMatchPreview['suggestedMatches'][number]['confidence']) => {
    if (confidence === 'Low') {
      // Allow explicit opt-in for Low only after user confirmation via selecting — still never bulk-applied by "Apply High"
      // User can select Low manually if they insist; applyMatchesDemo will reject Low unless we change that.
      // Spec: Never automatically apply low-confidence — manual select of Low is still blocked at apply for safety.
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  const selectHighOnly = () => {
    if (!preview) return
    setSelected(new Set(preview.suggestedMatches.filter((m) => m.confidence === 'High').map((m) => m.matchId)))
  }

  const selectHighAndMedium = () => {
    if (!preview) return
    setSelected(
      new Set(
        preview.suggestedMatches
          .filter((m) => m.confidence === 'High' || m.confidence === 'Medium')
          .map((m) => m.matchId),
      ),
    )
  }

  const apply = async () => {
    if (!preview || selected.size === 0) return
    const eligible = preview.suggestedMatches.filter(
      (m) => selected.has(m.matchId) && m.confidence !== 'Low',
    )
    if (eligible.length === 0) {
      notify.error('Low-confidence matches are never applied automatically. Review them in the workbench instead.')
      return
    }
    setBusy(true)
    try {
      const updated = await applyMatchesDemo(reconciliationId, eligible.map((m) => m.matchId))
      notify.success(`Applied ${eligible.length} match(es) (demo — not posted to a live bank feed).`)
      onApplied(updated)
      onClose()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Failed to apply matches.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label="Close dialog" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-match-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-erp-border bg-white shadow-xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-erp-border px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-erp-muted">Bank Reconciliation</p>
            <h2 id="auto-match-title" className="flex items-center gap-1.5 text-[15px] font-semibold text-erp-text">
              <Wand2 className="h-4 w-4 text-erp-primary" />
              Auto-match preview
            </h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              High confidence is pre-selected. Medium needs review. Low is never auto-applied.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-erp-muted hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-[13px] text-erp-muted">Calculating suggested matches…</p>
          ) : preview ? (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-2 rounded-md border border-erp-border bg-erp-surface-alt/40 p-3 text-[12px] sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="Statement Lines" value={preview.totalStatementLines} />
                <Stat label="Exact Matches" value={preview.exactMatches} className="text-emerald-700" />
                <Stat label="Suggested" value={preview.suggestedMatchCount} className="text-amber-700" />
                <Stat label="Ambiguous" value={preview.ambiguousMatches} className="text-rose-700" />
                <Stat label="Unmatched Lines" value={preview.unmatchedLines} />
                <Stat label="Amount Matched" value={formatCurrency(preview.amountMatched)} className="text-emerald-700" />
                <Stat label="Remaining Diff" value={formatCurrency(preview.remainingDifference)} className={preview.remainingDifference ? 'text-rose-700' : 'text-emerald-700'} />
              </dl>

              <div className="mb-2 flex flex-wrap gap-2">
                <button type="button" className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" onClick={selectHighOnly}>
                  Select high confidence only
                </button>
                <button type="button" className="erp-btn erp-btn-ghost h-8 px-2.5 text-[11px]" onClick={selectHighAndMedium}>
                  Review suggested (include medium)
                </button>
              </div>

              <div className="overflow-x-auto rounded-md border border-erp-border">
                <table className="erp-table w-full min-w-[720px] text-[12px]">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th>Statement line</th>
                      <th>Book line</th>
                      <th className="text-right">Amount</th>
                      <th>Criteria</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.suggestedMatches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-erp-muted">
                          No suggested matches found. Use manual matching in the workbench.
                        </td>
                      </tr>
                    ) : (
                      preview.suggestedMatches.map((m) => (
                        <tr key={m.matchId} className={cn(m.confidence === 'Low' && 'opacity-60')}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(m.matchId)}
                              disabled={m.confidence === 'Low'}
                              onChange={() => toggle(m.matchId, m.confidence)}
                              aria-label={
                                m.confidence === 'Low'
                                  ? 'Low confidence — not selectable for auto-apply'
                                  : `Select match for ${formatCurrency(m.amount)}`
                              }
                              title={m.confidence === 'Low' ? 'Low-confidence matches are never auto-applied' : undefined}
                            />
                          </td>
                          <td className="max-w-[14rem] truncate" title={m.statementDescription}>
                            {m.statementDescription}
                          </td>
                          <td className="max-w-[14rem] truncate" title={m.bookDescription}>
                            {m.bookDescription}
                          </td>
                          <td className="text-right tabular-nums font-medium">{formatCurrency(m.amount)}</td>
                          <td className="text-[11px] text-erp-muted">{m.criteria.join(' · ')}</td>
                          <td>
                            <MatchConfidenceBadge confidence={m.confidence} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-[11px] text-erp-muted">
                Matching criteria: Amount, Date, Reference, UTR, Cheque Number, Party Name, Narration.
                Low-confidence rows are disabled here — resolve them with manual match in the workbench.
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-[13px] text-erp-muted">Unable to load auto-match preview.</p>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-erp-border bg-erp-surface px-4 py-3">
          <span className="text-[12px] text-erp-muted">{selected.size} match(es) selected for apply</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] font-semibold" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-secondary h-9 px-3 text-[13px] font-semibold"
              onClick={selectHighAndMedium}
              disabled={!preview}
            >
              Review suggested matches
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px] font-semibold"
              disabled={selected.size === 0 || busy}
              onClick={() => void apply()}
            >
              {busy ? 'Applying…' : 'Apply high-confidence matches'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div>
      <dt className="text-erp-muted">{label}</dt>
      <dd className={cn('font-semibold text-erp-text', className)}>{value}</dd>
    </div>
  )
}
