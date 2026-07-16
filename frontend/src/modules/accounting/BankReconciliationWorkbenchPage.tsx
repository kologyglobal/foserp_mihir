import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Check,
  Filter,
  GitMerge,
  Link2,
  Link2Off,
  RotateCcw,
  Save,
  Slash,
  Wand2,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  AutoMatchPreviewModal,
  BankCashConfirmModal,
  BankCashDemoBanner,
  BankCashEmptyState,
  BankCashWorkspaceTabs,
  MatchConfidenceBadge,
  MatchStatusBadge,
  ReconciliationFlowStrip,
  ReconciliationStatusBadge,
} from '@/components/accounting/bankCash'
import {
  completeReconciliationDemo,
  getReconciliationById,
  ignoreLinesDemo,
  manualMatchDemo,
  reopenReconciliationDemo,
  saveReconciliationDraft,
  unmatchLinesDemo,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { MatchStatus, Reconciliation, ReconciliationLine } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MQ_BELOW_LG, MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/utils/cn'

type PaneFilter = 'all' | 'unmatched' | 'matched' | 'suggested'
type MobileStep = 'statement' | 'book' | 'summary'

function isOpenStatus(s: MatchStatus) {
  return s === 'Unmatched' || s === 'Suggested' || s === 'Partially Matched' || s === 'Adjustment Required' || s === 'Difference'
}

function summarize(recon: Reconciliation) {
  const open = (l: ReconciliationLine) => !['Matched', 'Ignored', 'Excluded', 'Duplicate'].includes(l.matchStatus)
  const stmt = recon.lines.filter((l) => l.side === 'statement' && open(l))
  const book = recon.lines.filter((l) => l.side === 'book' && open(l))

  const paymentsInTransit = book.filter((l) => l.debitAmount > 0 && /transit/i.test(l.description)).reduce((s, l) => s + l.debitAmount, 0)
  const depositsInTransit = book.filter((l) => l.creditAmount > 0 && /transit/i.test(l.description)).reduce((s, l) => s + l.creditAmount, 0)
  const bankCharges = stmt.filter((l) => /charge|fee|sms|maintenance|imps fee/i.test(l.description)).reduce((s, l) => s + l.debitAmount, 0)
  const interest = stmt.filter((l) => /interest/i.test(l.description)).reduce((s, l) => s + l.creditAmount, 0)
  const adjustments = recon.adjustmentPosted ? recon.adjustmentAmount : stmt.filter((l) => l.matchStatus === 'Adjustment Required').reduce((s, l) => s + l.debitAmount - l.creditAmount, 0)
  const unmatchedAmount = stmt.filter((l) => isOpenStatus(l.matchStatus) && !/transit|interest|charge|fee|sms|maintenance/i.test(l.description)).reduce((s, l) => s + l.amount, 0)
    + book.filter((l) => isOpenStatus(l.matchStatus) && !/transit/i.test(l.description)).reduce((s, l) => s + l.amount, 0)

  return {
    paymentsInTransit,
    depositsInTransit,
    bankCharges,
    interest,
    adjustments,
    unmatchedAmount,
    finalDifference: recon.finalDifference,
  }
}

function filterLines(lines: ReconciliationLine[], filter: PaneFilter) {
  if (filter === 'unmatched') return lines.filter((l) => isOpenStatus(l.matchStatus))
  if (filter === 'matched') return lines.filter((l) => l.matchStatus === 'Matched' || l.matchStatus === 'Partially Matched')
  if (filter === 'suggested') return lines.filter((l) => l.matchStatus === 'Suggested' || l.confidence === 'High' || l.confidence === 'Medium')
  return lines
}

export function BankReconciliationWorkbenchPage() {
  const { id = '' } = useParams()
  const perms = useBankCashPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)
  const isTablet = useMediaQuery(MQ_BELOW_LG)

  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoMatchOpen, setAutoMatchOpen] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedStmt, setSelectedStmt] = useState<Set<string>>(new Set())
  const [selectedBook, setSelectedBook] = useState<Set<string>>(new Set())
  const [allowPartial, setAllowPartial] = useState(false)
  const [paneFilter, setPaneFilter] = useState<PaneFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileStep, setMobileStep] = useState<MobileStep>('statement')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const r = await getReconciliationById(id)
      if (signal?.cancelled) return
      if (!r) {
        setRecon(null)
        setError('Reconciliation not found')
        setLoading(false)
        return
      }
      setRecon(r)
      setLoading(false)
    } catch (err) {
      if (signal?.cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation')
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  const statementLines = useMemo(() => {
    const base = recon?.lines.filter((l) => l.side === 'statement') ?? []
    const filtered = filterLines(base, paneFilter)
    if (!search.trim()) return filtered
    const q = search.toLowerCase()
    return filtered.filter((l) => `${l.description} ${l.reference}`.toLowerCase().includes(q))
  }, [recon, paneFilter, search])

  const bookLines = useMemo(() => {
    const base = recon?.lines.filter((l) => l.side === 'book') ?? []
    const filtered = filterLines(base, paneFilter)
    if (!search.trim()) return filtered
    const q = search.toLowerCase()
    return filtered.filter((l) => `${l.description} ${l.reference}`.toLowerCase().includes(q))
  }, [recon, paneFilter, search])

  const summary = useMemo(() => (recon ? summarize(recon) : null), [recon])
  const isCompleted = recon?.status === 'Completed'
  const hasDifference = Boolean(recon && Math.abs(recon.finalDifference) > 0.009)
  const selectedStmtAmt = useMemo(
    () => statementLines.filter((l) => selectedStmt.has(l.id)).reduce((s, l) => s + l.amount, 0),
    [statementLines, selectedStmt],
  )
  const selectedBookAmt = useMemo(
    () => bookLines.filter((l) => selectedBook.has(l.id)).reduce((s, l) => s + l.amount, 0),
    [bookLines, selectedBook],
  )
  const selectionDiff = Math.abs(selectedStmtAmt - selectedBookAmt)

  const flowActive = useMemo(() => {
    if (!recon) return 'manual' as const
    if (isCompleted) return 'complete' as const
    if (hasDifference) return 'difference' as const
    if (selectedStmt.size + selectedBook.size > 0) return 'manual' as const
    return 'automatch' as const
  }, [recon, isCompleted, hasDifference, selectedStmt.size, selectedBook.size])

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Bank & Cash', to: '/accounting/bank-cash' },
    { label: 'Bank Reconciliation', to: '/accounting/bank-cash/reconciliation' },
    { label: recon?.reconciliationNumber ?? '…' },
  ]

  const toggle = (side: 'statement' | 'book', lineId: string) => {
    if (isCompleted) return
    const setter = side === 'statement' ? setSelectedStmt : setSelectedBook
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedStmt(new Set())
    setSelectedBook(new Set())
  }

  const handleManualMatch = async () => {
    if (!recon || !perms.canManageReconciliation) return
    setBusy(true)
    try {
      const updated = await manualMatchDemo(recon.id, {
        statementLineIds: Array.from(selectedStmt),
        bookLineIds: Array.from(selectedBook),
        allowPartial,
      })
      setRecon(updated)
      clearSelection()
      notify.success(
        selectionDiff > 0.01
          ? 'Partial match applied in demo mode. No ledger adjustments were posted.'
          : 'Manual match applied in demo mode. No ledger adjustments were posted.',
      )
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Match failed')
    } finally {
      setBusy(false)
    }
  }

  const handleUnmatch = async () => {
    if (!recon || !perms.canManageReconciliation) return
    const ids = [...selectedStmt, ...selectedBook]
    if (ids.length === 0) return notify.error('Select matched lines to unmatch.')
    setBusy(true)
    try {
      const updated = await unmatchLinesDemo(recon.id, ids)
      setRecon(updated)
      clearSelection()
      notify.success('Lines unmatched in demo mode.')
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Unmatch failed')
    } finally {
      setBusy(false)
    }
  }

  const handleIgnore = async () => {
    if (!recon || !perms.canManageReconciliation) return
    const ids = [...selectedStmt, ...selectedBook]
    if (ids.length === 0) return notify.error('Select lines to ignore.')
    setBusy(true)
    try {
      const updated = await ignoreLinesDemo(recon.id, ids)
      setRecon(updated)
      clearSelection()
      notify.success('Lines ignored in demo mode.')
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Ignore failed')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!recon || !perms.canManageReconciliation) return
    setBusy(true)
    try {
      const updated = await saveReconciliationDraft(recon.id, {
        adjustmentAmount: recon.adjustmentAmount,
        adjustmentReason: recon.adjustmentReason,
        adjustmentPosted: recon.adjustmentPosted,
      })
      setRecon(updated)
      notify.success('Reconciliation draft saved (demo).')
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const runComplete = async (allowAdjustment: boolean) => {
    if (!recon) return
    setBusy(true)
    try {
      const updated = await completeReconciliationDemo(recon.id, { allowAdjustment })
      notify.success('Reconciliation marked completed in demo mode. Bank and ledger records were not updated.')
      setRecon(updated)
      setAdjustmentOpen(false)
      setAdjustmentReason('')
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Complete failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmAdjustmentAndComplete = async () => {
    if (!recon || !adjustmentReason.trim()) {
      notify.error('Adjustment reason is required.')
      return
    }
    if (!perms.canCompleteReconciliation) return
    setBusy(true)
    try {
      await saveReconciliationDraft(recon.id, {
        adjustmentAmount: recon.finalDifference,
        adjustmentReason: adjustmentReason.trim(),
        adjustmentPosted: true,
      })
      await runComplete(true)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Adjustment failed')
      setBusy(false)
    }
  }

  const handleReopen = async () => {
    if (!recon) return
    setBusy(true)
    try {
      const updated = await reopenReconciliationDemo(recon.id)
      notify.success(`${updated.reconciliationNumber} reopened for further matching`)
      setRecon(updated)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Reopen failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView || !perms.canViewReconciliation) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Reconciliation" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" description="You cannot view this reconciliation." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Reconciliation Workbench" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={10} />
      </OperationalPageShell>
    )
  }

  if (!recon || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState
          title="Reconciliation not found"
          description={error ?? undefined}
          actions={<Link to="/accounting/bank-cash/reconciliation" className="erp-btn erp-btn-primary inline-flex h-9 items-center px-4 text-[13px]">Back to list</Link>}
        />
      </OperationalPageShell>
    )
  }

  const canMatch = !isCompleted && perms.canManageReconciliation && selectedStmt.size > 0 && selectedBook.size > 0

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={`Reconciliation ${recon.reconciliationNumber}`}
      description={`${recon.bankAccountName} · ${formatDate(recon.periodFrom)} – ${formatDate(recon.periodTo)}`}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/reconciliation/${recon.id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={
            !isCompleted && perms.canManageReconciliation
              ? { id: 'automatch', label: 'Auto-Match Preview', icon: Wand2, variant: 'primary', onClick: () => setAutoMatchOpen(true) }
              : undefined
          }
          secondaryActions={[
            ...(!isCompleted && perms.canManageReconciliation
              ? [
                  { id: 'match', label: 'Manual Match', icon: Link2, onClick: () => void handleManualMatch(), disabled: !canMatch || busy },
                  { id: 'unmatch', label: 'Unmatch', icon: Link2Off, onClick: () => void handleUnmatch(), disabled: busy },
                  { id: 'save', label: 'Save Draft', icon: Save, onClick: () => void handleSaveDraft(), disabled: busy },
                ]
              : []),
            ...(!isCompleted && perms.canCompleteReconciliation
              ? [{
                  id: 'complete',
                  label: busy ? 'Completing…' : 'Complete in Demo',
                  icon: Check,
                  onClick: () => {
                    if (hasDifference && !recon.adjustmentPosted) setAdjustmentOpen(true)
                    else void runComplete(Boolean(recon.adjustmentPosted))
                  },
                }]
              : []),
            ...(isCompleted && perms.canReopenReconciliation
              ? [{ id: 'reopen', label: 'Reopen', icon: RotateCcw, onClick: () => void handleReopen() }]
              : []),
          ]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="reconciliation" />

      <div className="mt-3 space-y-3">
        <BankCashDemoBanner message="Reconciliation matching runs against frontend demo data. No live bank feed is contacted and no ledger posting occurs." />

        <ReconciliationFlowStrip
          active={flowActive}
          completedThrough={isCompleted ? 'complete' : hasDifference ? 'manual' : 'validate'}
          compact={isTablet}
        />

        {/* Sticky reconciliation header + difference status */}
        <div className="sticky top-0 z-20 rounded-md border border-erp-border bg-white/95 shadow-sm backdrop-blur">
          <div className="grid gap-2 border-b border-erp-border px-3 py-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <HeaderCell label="Bank Account" value={recon.bankAccountName} />
            <HeaderCell label="Statement Period" value={`${formatDate(recon.periodFrom)} – ${formatDate(recon.periodTo)}`} />
            <HeaderCell label="Stmt Opening" value={formatCurrency(recon.openingStatementBalance)} mono />
            <HeaderCell label="Stmt Closing" value={formatCurrency(recon.closingStatementBalance)} mono />
            <HeaderCell label="Book Balance" value={formatCurrency(recon.closingBookBalance)} mono />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Status</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <ReconciliationStatusBadge status={recon.status} />
                {hasDifference ? (
                  <span className="text-[12px] font-semibold text-rose-700">
                    Difference Remaining: {formatCurrency(Math.abs(recon.finalDifference))}
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold text-emerald-700">Reconciled</span>
                )}
              </div>
            </div>
          </div>

          {summary ? (
            <div className="grid grid-cols-2 gap-px bg-erp-border sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
              <SummaryCell label="Stmt Closing" value={formatCurrency(recon.closingStatementBalance)} />
              <SummaryCell label="Book Balance" value={formatCurrency(recon.closingBookBalance)} />
              <SummaryCell label="Payments in Transit" value={formatCurrency(summary.paymentsInTransit)} tone="amber" />
              <SummaryCell label="Deposits in Transit" value={formatCurrency(summary.depositsInTransit)} tone="blue" />
              <SummaryCell label="Bank Charges" value={formatCurrency(summary.bankCharges)} tone="amber" />
              <SummaryCell label="Interest" value={formatCurrency(summary.interest)} tone="green" />
              <SummaryCell label="Adjustments" value={formatCurrency(summary.adjustments)} />
              <SummaryCell label="Unmatched Amount" value={formatCurrency(summary.unmatchedAmount)} tone="amber" />
              <SummaryCell
                label="Final Difference"
                value={formatCurrency(summary.finalDifference)}
                tone={Math.abs(summary.finalDifference) > 0.009 ? 'red' : 'green'}
                emphasize
              />
            </div>
          ) : null}
        </div>

        {/* Matching toolbar */}
        {!isCompleted ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-erp-border bg-erp-surface/50 px-3 py-2">
            <button type="button" className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" onClick={() => setAutoMatchOpen(true)} disabled={!perms.canManageReconciliation}>
              <Wand2 className="mr-1 inline h-3.5 w-3.5" /> Auto-Match Preview
            </button>
            <button type="button" className="erp-btn erp-btn-secondary h-8 px-2.5 text-[11px]" disabled={!canMatch || busy} onClick={() => void handleManualMatch()}>
              <GitMerge className="mr-1 inline h-3.5 w-3.5" /> Manual Match
            </button>
            <button type="button" className="erp-btn erp-btn-ghost h-8 px-2.5 text-[11px]" disabled={busy} onClick={() => void handleUnmatch()}>
              <Link2Off className="mr-1 inline h-3.5 w-3.5" /> Unmatch
            </button>
            <button type="button" className="erp-btn erp-btn-ghost h-8 px-2.5 text-[11px]" disabled={busy} onClick={() => void handleIgnore()}>
              <Slash className="mr-1 inline h-3.5 w-3.5" /> Ignore
            </button>
            <button type="button" className="erp-btn erp-btn-ghost h-8 px-2.5 text-[11px]" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="mr-1 inline h-3.5 w-3.5" /> Filters
            </button>
            <label className="ml-auto flex items-center gap-1.5 text-[11px] text-erp-muted">
              <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
              Allow partial match
            </label>
            {(selectedStmt.size > 0 || selectedBook.size > 0) ? (
              <div className="w-full rounded border border-erp-border bg-white px-2 py-1.5 text-[11px] sm:w-auto">
                <span className="font-semibold text-erp-text">Selection:</span>{' '}
                {selectedStmt.size} stmt ({formatCurrency(selectedStmtAmt)}) · {selectedBook.size} book ({formatCurrency(selectedBookAmt)})
                {selectionDiff > 0.01 ? (
                  <span className="ml-2 font-semibold text-rose-700">Δ {formatCurrency(selectionDiff)}</span>
                ) : selectedStmt.size && selectedBook.size ? (
                  <span className="ml-2 font-semibold text-emerald-700">Amounts balanced</span>
                ) : null}
                <button type="button" className="ml-2 text-erp-primary hover:underline" onClick={clearSelection}>Clear</button>
              </div>
            ) : (
              <p className="w-full text-[11px] text-erp-muted sm:ml-0 sm:w-auto">
                Select lines on both panes for 1:1, 1:N or N:1 matching.
              </p>
            )}
          </div>
        ) : null}

        {showFilters ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
            <label className="text-[11px] text-erp-muted">
              Line filter
              <select className="mt-0.5 block h-9 min-w-[140px] rounded-md border border-erp-border px-2 text-[12px]" value={paneFilter} onChange={(e) => setPaneFilter(e.target.value as PaneFilter)}>
                <option value="all">All lines</option>
                <option value="unmatched">Unmatched / open</option>
                <option value="matched">Matched</option>
                <option value="suggested">Suggested</option>
              </select>
            </label>
            <label className="min-w-[200px] flex-1 text-[11px] text-erp-muted">
              Search description / reference
              <input className="mt-0.5 block h-9 w-full rounded-md border border-erp-border px-2 text-[12px]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="UTR, cheque, party…" />
            </label>
          </div>
        ) : null}

        {isMobile ? (
          <div className="flex gap-1 border-b border-erp-border">
            {([
              ['statement', 'Bank Statement'],
              ['book', 'Book'],
              ['summary', 'Summary'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn('flex-1 border-b-2 px-2 py-2 text-[12px] font-semibold', mobileStep === id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted')}
                onClick={() => setMobileStep(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Two-pane workbench */}
        <div className={cn('grid gap-3', !isMobile && 'lg:grid-cols-2')}>
          {(!isMobile || mobileStep === 'statement') ? (
            <MatchPane
              title="Bank Statement Transactions"
              subtitle={`${statementLines.length} line(s) · select to match`}
              lines={statementLines}
              selected={selectedStmt}
              onToggle={(lineId) => toggle('statement', lineId)}
              readOnly={isCompleted}
              showParty={false}
            />
          ) : null}
          {(!isMobile || mobileStep === 'book') ? (
            <MatchPane
              title="Book Transactions"
              subtitle={`${bookLines.length} line(s) · voucher / party view`}
              lines={bookLines}
              selected={selectedBook}
              onToggle={(lineId) => toggle('book', lineId)}
              readOnly={isCompleted}
              showParty
            />
          ) : null}
        </div>

        {(isMobile && mobileStep === 'summary') || !isMobile ? (
          <section className="rounded-md border border-erp-border bg-white p-3">
            <h3 className="text-[13px] font-semibold text-erp-text">Difference review</h3>
            <p className="mt-1 text-[12px] text-erp-muted">
              Completion is blocked while an unexplained difference remains, unless an authorised adjustment is recorded (demo only — no GL posting).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {hasDifference ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-800">
                  Difference Remaining: {formatCurrency(Math.abs(recon.finalDifference))}
                </p>
              ) : (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800">
                  Reconciled — ready for completion in demo mode
                </p>
              )}
              {recon.adjustmentPosted ? (
                <p className="text-[12px] text-erp-muted">
                  Authorised adjustment: {formatCurrency(recon.adjustmentAmount)} — {recon.adjustmentReason}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <AutoMatchPreviewModal
        open={autoMatchOpen}
        onClose={() => setAutoMatchOpen(false)}
        reconciliationId={recon.id}
        onApplied={(updated) => {
          setRecon(updated)
          clearSelection()
        }}
      />

      <BankCashConfirmModal
        open={adjustmentOpen}
        onClose={() => {
          setAdjustmentOpen(false)
          setAdjustmentReason('')
        }}
        title="Authorise adjustment & complete"
        description={`Difference of ${formatCurrency(recon.finalDifference)} remains. Enter an authorised reason to complete in demo mode. Bank and ledger records will not be updated.`}
        confirmLabel={busy ? 'Completing…' : 'Approve adjustment & complete'}
        onConfirm={() => void confirmAdjustmentAndComplete()}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="e.g. Account maintenance fee — book bank charge voucher next period"
          value={adjustmentReason}
          onChange={(e) => setAdjustmentReason(e.target.value)}
        />
      </BankCashConfirmModal>
    </OperationalPageShell>
  )
}

function HeaderCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
      <p className={cn('mt-0.5 truncate text-[12px] font-semibold text-erp-text', mono && 'tabular-nums')}>{value}</p>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  tone,
  emphasize,
}: {
  label: string
  value: string
  tone?: 'amber' | 'blue' | 'green' | 'red'
  emphasize?: boolean
}) {
  const toneClass =
    tone === 'amber' ? 'text-amber-800'
      : tone === 'blue' ? 'text-sky-800'
        : tone === 'green' ? 'text-emerald-800'
          : tone === 'red' ? 'text-rose-800'
            : 'text-erp-text'
  return (
    <div className={cn('bg-white px-2 py-2', emphasize && 'bg-erp-surface')}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
      <p className={cn('mt-0.5 text-[12px] tabular-nums font-semibold', toneClass, emphasize && 'text-[13px]')}>{value}</p>
    </div>
  )
}

function MatchPane({
  title,
  subtitle,
  lines,
  selected,
  onToggle,
  readOnly,
  showParty,
}: {
  title: string
  subtitle: string
  lines: ReconciliationLine[]
  selected: Set<string>
  onToggle: (id: string) => void
  readOnly: boolean
  showParty: boolean
}) {
  return (
    <section className="flex min-h-[22rem] min-w-0 flex-col rounded-md border border-erp-border bg-white">
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-erp-border px-3 py-2">
        <div>
          <h3 className="text-[13px] font-semibold text-erp-text">{title}</h3>
          <p className="text-[11px] text-erp-muted">{subtitle}</p>
        </div>
        <span className="rounded bg-erp-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-erp-muted">
          {selected.size} selected
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[36rem] text-left text-[12px]">
          <thead className="sticky top-0 z-[1] bg-erp-surface text-[10px] uppercase tracking-wide text-erp-muted">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2 font-semibold">{showParty ? 'Posting Date' : 'Date'}</th>
              <th className="px-2 py-2 font-semibold">Description</th>
              <th className="px-2 py-2 font-semibold">Reference</th>
              {showParty ? <th className="px-2 py-2 font-semibold">Narration / Party</th> : null}
              <th className="px-2 py-2 text-right font-semibold">Debit</th>
              <th className="px-2 py-2 text-right font-semibold">Credit</th>
              <th className="px-2 py-2 font-semibold">Match</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const isSelected = selected.has(l.id)
              const matched = l.matchStatus === 'Matched' || l.matchStatus === 'Partially Matched'
              return (
                <tr
                  key={l.id}
                  className={cn(
                    'border-t border-erp-border/70 cursor-pointer',
                    isSelected && 'bg-sky-50/80',
                    matched && !isSelected && 'bg-emerald-50/40',
                    l.matchStatus === 'Adjustment Required' && 'bg-orange-50/50',
                    l.matchStatus === 'Ignored' && 'opacity-50',
                  )}
                  onClick={() => !readOnly && onToggle(l.id)}
                >
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={readOnly}
                      onChange={() => onToggle(l.id)}
                      aria-label={`Select ${l.description}`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{formatDate(l.lineDate)}</td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5 font-medium" title={l.description}>{l.description}</td>
                  <td className="max-w-[8rem] truncate px-2 py-1.5 font-mono text-[11px] text-erp-muted" title={l.reference}>{l.reference || '—'}</td>
                  {showParty ? (
                    <td className="max-w-[10rem] truncate px-2 py-1.5 text-erp-muted" title={l.description}>{l.description}</td>
                  ) : null}
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.debitAmount ? formatCurrency(l.debitAmount) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{l.creditAmount ? formatCurrency(l.creditAmount) : '—'}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col gap-0.5">
                      <MatchStatusBadge status={l.matchStatus} />
                      {l.confidence ? <MatchConfidenceBadge confidence={l.confidence} /> : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={showParty ? 8 : 7} className="px-3 py-10 text-center text-erp-muted">No lines for this filter.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
