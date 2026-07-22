import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { fetchCandidatesForLine, createMatch, previewMatch } from '../api/bank-reconciliation.api'
import type {
  BankReconciliationMatchDto,
  LedgerAllocationInput,
  MatchPreviewResultDto,
  ScoredLedgerCandidateDto,
  StatementLineDto,
} from '../api/bank-reconciliation.types'
import { CandidateTable } from './CandidateTable'
import { ClearingPreviewPanel } from './ClearingPreviewPanel'
import { parseDecimal } from '../utils/bankReconciliationUi'
import { useIdempotencyKey } from '../utils/idempotency'

export interface ManualMatchDrawerProps {
  open: boolean
  onClose: () => void
  statementId: string
  selectedLines: StatementLineDto[]
  canGroupMatch: boolean
  canPartialMatch: boolean
  onMatched: (match: BankReconciliationMatchDto) => void
}

/** Manual / grouped / partial match builder — pick ledger candidates, preview posting impact, confirm. */
export function ManualMatchDrawer({
  open,
  onClose,
  statementId,
  selectedLines,
  canGroupMatch,
  canPartialMatch,
  onMatched,
}: ManualMatchDrawerProps) {
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [direct, setDirect] = useState<ScoredLedgerCandidateDto[]>([])
  const [clearing, setClearing] = useState<ScoredLedgerCandidateDto[]>([])
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({})
  const [selectedEntries, setSelectedEntries] = useState<Map<string, string>>(new Map())
  const [preview, setPreview] = useState<MatchPreviewResultDto | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')

  const primaryLineId = selectedLines[0]?.id

  useEffect(() => {
    if (!open || !primaryLineId) return
    setLineAmounts(
      Object.fromEntries(selectedLines.map((l) => [l.id, parseDecimal(l.remainingAmount).toFixed(2)])),
    )
    setSelectedEntries(new Map())
    setPreview(null)
    setNote('')
    setLoadingCandidates(true)
    fetchCandidatesForLine(statementId, primaryLineId)
      .then((res) => {
        setDirect(res.direct)
        setClearing(res.clearing)
      })
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load candidates'))
      .finally(() => setLoadingCandidates(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, primaryLineId, statementId])

  const statementTotal = useMemo(
    () => selectedLines.reduce((sum, l) => sum + parseDecimal(lineAmounts[l.id] ?? l.remainingAmount), 0),
    [selectedLines, lineAmounts],
  )
  const ledgerTotal = useMemo(
    () => [...selectedEntries.values()].reduce((sum, v) => sum + parseDecimal(v), 0),
    [selectedEntries],
  )
  const amountsBalanced = selectedLines.length > 0 && selectedEntries.size > 0 && Math.abs(statementTotal - ledgerTotal) < 0.005

  const signature = useMemo(
    () =>
      JSON.stringify({
        statementId,
        lines: selectedLines.map((l) => [l.id, lineAmounts[l.id]]).sort(),
        entries: [...selectedEntries.entries()].sort(),
        note,
      }),
    [statementId, selectedLines, lineAmounts, selectedEntries, note],
  )
  const resolveIdempotencyKey = useIdempotencyKey(signature)

  if (!open) return null

  const toggleEntry = (candidate: ScoredLedgerCandidateDto) => {
    setPreview(null)
    setSelectedEntries((prev) => {
      const next = new Map(prev)
      if (next.has(candidate.generalLedgerEntryId)) {
        next.delete(candidate.generalLedgerEntryId)
      } else {
        next.set(candidate.generalLedgerEntryId, parseDecimal(candidate.unreconciledAmount).toFixed(2))
      }
      return next
    })
  }

  const runPreview = async () => {
    if (!amountsBalanced) {
      notify.error('Statement allocation total must equal ledger allocation total before previewing')
      return
    }
    setPreviewing(true)
    try {
      const ledgerAllocations: LedgerAllocationInput[] = [...selectedEntries.entries()].map(([id, amount]) => ({
        generalLedgerEntryId: id,
        amount,
      }))
      const result = await previewMatch({
        statementId,
        statementAllocations: selectedLines.map((l) => ({ bankStatementLineId: l.id, amount: lineAmounts[l.id] ?? l.remainingAmount })),
        ledgerAllocations,
        note: note.trim() || null,
      })
      setPreview(result)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Preview failed')
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  const runConfirm = async () => {
    if (!preview) return
    setConfirming(true)
    try {
      const ledgerAllocations: LedgerAllocationInput[] = [...selectedEntries.entries()].map(([id, amount]) => ({
        generalLedgerEntryId: id,
        amount,
      }))
      const match = await createMatch({
        statementId,
        statementAllocations: selectedLines.map((l) => ({ bankStatementLineId: l.id, amount: lineAmounts[l.id] ?? l.remainingAmount })),
        ledgerAllocations,
        note: note.trim() || null,
        idempotencyKey: resolveIdempotencyKey(),
      })
      notify.success(match.idempotentReplay ? 'Match already recorded (idempotent replay)' : `Match ${match.matchReference} created`)
      onMatched(match)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Match creation failed')
    } finally {
      setConfirming(false)
    }
  }

  const isGrouped = selectedLines.length > 1 || selectedEntries.size > 1
  const isPartial = selectedLines.some((l) => Math.abs(parseDecimal(lineAmounts[l.id] ?? l.remainingAmount) - parseDecimal(l.remainingAmount)) > 0.005)

  return (
    <>
      <div className="erp-right-drawer fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="erp-right-drawer fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-erp-border bg-erp-surface shadow-erp-md">
        <div className="flex shrink-0 items-center justify-between border-b border-erp-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-erp-text">Manual Match</h2>
            <p className="mt-0.5 text-[12px] text-erp-muted">
              {selectedLines.length} statement line(s) selected
              {isGrouped ? ' · grouped' : ''}
              {isPartial ? ' · partial' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-erp-surface-alt" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {isGrouped && !canGroupMatch ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              You do not have permission to create grouped (1:N / N:1) matches — reduce your selection to one statement line and
              one ledger entry.
            </p>
          ) : null}
          {isPartial && !canPartialMatch ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              You do not have permission to create partial matches — allocate the full remaining amount.
            </p>
          ) : null}

          <section>
            <h3 className="mb-1 text-[12px] font-semibold text-erp-text">Statement lines</h3>
            <div className="space-y-1.5">
              {selectedLines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded border border-erp-border px-2 py-1.5 text-[12px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-erp-text">#{l.lineNumber} — {l.description ?? 'No description'}</p>
                    <p className="text-erp-muted">
                      {l.direction} · remaining {formatCurrency(parseDecimal(l.remainingAmount))}
                    </p>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lineAmounts[l.id] ?? ''}
                    onChange={(e) => {
                      setPreview(null)
                      setLineAmounts((prev) => ({ ...prev, [l.id]: e.target.value }))
                    }}
                    className="h-7 w-24 rounded border border-erp-border px-1.5 text-right text-[12px] tabular-nums"
                    aria-label={`Amount for line ${l.lineNumber}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {loadingCandidates ? (
            <LoadingState variant="table" rows={4} />
          ) : (
            <>
              <CandidateTable
                title="Direct bank GL candidates"
                candidates={direct}
                selected={selectedEntries}
                onToggle={toggleEntry}
                onAmountChange={(id, amount) => {
                  setPreview(null)
                  setSelectedEntries((prev) => new Map(prev).set(id, amount))
                }}
                emptyMessage="No unreconciled ledger entries found on the bank's own GL account."
              />
              <CandidateTable
                title="Clearing GL candidates"
                candidates={clearing}
                selected={selectedEntries}
                onToggle={toggleEntry}
                onAmountChange={(id, amount) => {
                  setPreview(null)
                  setSelectedEntries((prev) => new Map(prev).set(id, amount))
                }}
                emptyMessage="No unreconciled ledger entries found on the mapped clearing/settlement GL account."
              />
            </>
          )}

          <div className="rounded-md bg-erp-surface-alt px-3 py-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-erp-muted">Statement total</span>
              <span className="font-semibold tabular-nums">{formatCurrency(statementTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-erp-muted">Ledger total</span>
              <span className="font-semibold tabular-nums">{formatCurrency(ledgerTotal)}</span>
            </div>
            {!amountsBalanced && selectedEntries.size > 0 ? (
              <p className="mt-1 text-[11px] text-rose-700">Totals must match before you can preview this match.</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-erp-text" htmlFor="match-note">
              Note (optional)
            </label>
            <textarea
              id="match-note"
              value={note}
              onChange={(e) => {
                setPreview(null)
                setNote(e.target.value)
              }}
              rows={2}
              className="w-full rounded border border-erp-border px-2 py-1.5 text-[12px]"
              placeholder="Context for this manual match…"
            />
          </div>

          {preview ? (
            <div>
              <h3 className="mb-1 text-[12px] font-semibold text-erp-text">Preview</h3>
              <ClearingPreviewPanel preview={preview} />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-erp-border px-5 py-3">
          <ErpButtonGroup className="justify-end">
            <ErpButton type="button" variant="ghost" onClick={onClose}>
              Cancel
            </ErpButton>
            <ErpButton type="button" variant="secondary" loading={previewing} disabled={!amountsBalanced} onClick={() => void runPreview()}>
              Preview
            </ErpButton>
            <ErpButton type="button" variant="primary" loading={confirming} disabled={!preview} onClick={() => void runConfirm()}>
              Confirm Match
            </ErpButton>
          </ErpButtonGroup>
        </div>
      </aside>
    </>
  )
}
