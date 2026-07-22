import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, Wand2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { getFinanceSettings } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { formatDate } from '@/utils/dates/format'
import { mergeAllowedAction, useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import {
  acceptSuggestion,
  createException,
  finalizeSession,
  reopenSession,
  rejectSuggestion,
  resolveException,
  runAutoMatch as runAutoMatchApi,
} from '../api/bank-reconciliation.api'
import type { BankReconciliationExceptionReason, ExceptionDto, StatementLineDto, SuggestionDto } from '../api/bank-reconciliation.types'
import { SessionStatusChip } from '../components/BankReconciliationStatusChip'
import { DifferencePanel } from '../components/DifferencePanel'
import { ExceptionTable } from '../components/ExceptionTable'
import { FinalizationChecklist } from '../components/FinalizationChecklist'
import { ManualMatchDrawer } from '../components/ManualMatchDrawer'
import { CreateBankTransactionDrawer } from '../components/CreateBankTransactionDrawer'
import { ReconciliationSummaryCards } from '../components/ReconciliationSummaryCards'
import { ReconciliationWorkspaceShell } from '../components/ReconciliationWorkspaceShell'
import { StatementLineReconTable } from '../components/StatementLineReconTable'
import { SuggestionTable } from '../components/SuggestionTable'
import { useReconciliationWorkspace } from '../hooks/useReconciliationWorkspace'
import { useIdempotencyKey } from '../utils/idempotency'
import { EXCEPTION_REASON_LABELS, WORKSPACE_TABS, type WorkspaceTabId } from '../utils/bankReconciliationUi'

const EXCEPTION_REASON_OPTIONS = Object.entries(EXCEPTION_REASON_LABELS) as Array<[BankReconciliationExceptionReason, string]>

export function ApiReconciliationWorkspacePage() {
  const { statementId = '' } = useParams()
  const perms = useBankReconciliationPermissions()
  const { workspace, summary, suggestions, exceptions, loading, error, reload } = useReconciliationWorkspace(
    statementId,
    perms.canView,
  )

  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('unmatched')
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [matchDrawerOpen, setMatchDrawerOpen] = useState(false)
  const [bankTxnDrawerOpen, setBankTxnDrawerOpen] = useState(false)
  const [autoMatching, setAutoMatching] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  /** Phase 5B3 flag — default true when settings missing. */
  const [useTreasuryAdjustments, setUseTreasuryAdjustments] = useState(true)

  useEffect(() => {
    const legalEntityId = summary?.legalEntityId
    if (!legalEntityId) return
    void getFinanceSettings(legalEntityId)
      .then((s) => setUseTreasuryAdjustments(s.useTreasuryAdjustmentsForStatementItems ?? true))
      .catch(() => setUseTreasuryAdjustments(true))
  }, [summary?.legalEntityId])
  const [reopening, setReopening] = useState(false)
  const [busySuggestionId, setBusySuggestionId] = useState<string | null>(null)
  const [busyExceptionId, setBusyExceptionId] = useState<string | null>(null)
  const [exceptionPanelOpen, setExceptionPanelOpen] = useState(false)
  const [exceptionReason, setExceptionReason] = useState<BankReconciliationExceptionReason>('OTHER')
  const [exceptionComment, setExceptionComment] = useState('')

  const resolveAutoMatchKey = useIdempotencyKey(`auto-match:${statementId}`)
  const resolveFinalizeKey = useIdempotencyKey(`finalize:${statementId}:${summary?.updatedAt ?? ''}`)

  const lines = workspace?.lines ?? []
  const allowedActions = summary?.allowedActions ?? workspace?.allowedActions

  const linesByTab = useMemo(() => {
    switch (activeTab) {
      case 'unmatched':
        return lines.filter((l) => l.matchStatus === 'UNMATCHED')
      case 'partial':
        return lines.filter((l) => l.matchStatus === 'PARTIALLY_MATCHED')
      case 'matched':
        return lines.filter((l) => l.matchStatus === 'MATCHED' || l.matchStatus === 'RECONCILED')
      case 'all':
        return lines
      default:
        return []
    }
  }, [lines, activeTab])

  const toggleLine = (lineId: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  const selectedLines: StatementLineDto[] = lines.filter((l) => selectedLineIds.has(l.id))

  const runAutoMatch = async () => {
    if (!statementId) return
    setAutoMatching(true)
    try {
      const result = await runAutoMatchApi(statementId, { idempotencyKey: resolveAutoMatchKey() })
      notify.success(
        `Auto-match complete: ${result.matchesCreated} matched, ${result.suggestionsCreated} suggested, ${result.ambiguousLines} ambiguous`,
      )
      setSelectedLineIds(new Set())
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Auto-match run failed')
    } finally {
      setAutoMatching(false)
    }
  }

  const onAcceptSuggestion = async (suggestion: SuggestionDto) => {
    setBusySuggestionId(suggestion.id)
    try {
      const match = await acceptSuggestion(suggestion.id, { idempotencyKey: crypto.randomUUID() })
      notify.success(match.idempotentReplay ? 'Suggestion already accepted' : `Suggestion accepted — match ${match.matchReference}`)
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to accept suggestion')
    } finally {
      setBusySuggestionId(null)
    }
  }

  const onRejectSuggestion = async (suggestion: SuggestionDto) => {
    setBusySuggestionId(suggestion.id)
    try {
      await rejectSuggestion(suggestion.id, {})
      notify.success('Suggestion rejected')
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to reject suggestion')
    } finally {
      setBusySuggestionId(null)
    }
  }

  const onResolveException = async (exception: ExceptionDto, resolutionReference: string) => {
    setBusyExceptionId(exception.id)
    try {
      await resolveException(exception.id, { resolutionReference: resolutionReference || undefined })
      notify.success('Exception resolved')
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to resolve exception')
    } finally {
      setBusyExceptionId(null)
    }
  }

  const submitException = async () => {
    if (selectedLines.length !== 1) return
    try {
      await createException({
        statementId,
        bankStatementLineId: selectedLines[0].id,
        reason: exceptionReason,
        comment: exceptionComment.trim() || null,
      })
      notify.success('Exception reported')
      setExceptionPanelOpen(false)
      setExceptionComment('')
      setSelectedLineIds(new Set())
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to report exception')
    }
  }

  const onFinalize = async (force: boolean) => {
    setFinalizing(true)
    try {
      await finalizeSession(statementId, { idempotencyKey: resolveFinalizeKey(), force })
      notify.success('Reconciliation session finalized')
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Finalize failed')
    } finally {
      setFinalizing(false)
    }
  }

  const onReopen = async (reason: string) => {
    setReopening(true)
    try {
      await reopenSession(statementId, { reason })
      notify.success('Reconciliation session reopened')
      void reload()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reopen failed')
    } finally {
      setReopening(false)
    }
  }

  if (!perms.canView) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation Workspace">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank reconciliation.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation Workspace">
        <LoadingState variant="dashboard" />
      </ReconciliationWorkspaceShell>
    )
  }

  if (error || !workspace || !summary) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation Workspace">
        <PageBackLink to="/accounting/bank-cash/reconciliation" label="Back to reconciliation" className="mb-3" />
        <p className="text-[13px] text-erp-muted">
          {error ?? 'Reconciliation workspace could not be loaded. The statement must be VALIDATED before reconciliation can begin.'}
        </p>
      </ReconciliationWorkspaceShell>
    )
  }

  return (
    <ReconciliationWorkspaceShell
      title={`Reconciliation — ${formatDate(workspace.statement.periodStartDate)} to ${formatDate(workspace.statement.periodEndDate)}`}
      commandBar={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canRunAutoMatch, allowedActions?.runAutoMatch) ? (
            <ErpButton icon={Wand2} loading={autoMatching} onClick={() => void runAutoMatch()}>
              Run Auto Match
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canMatch, allowedActions?.match) ? (
            <ErpButton
              variant="secondary"
              disabled={selectedLines.length === 0}
              disabledReason="Select one or more unmatched/partially matched lines first"
              onClick={() => setMatchDrawerOpen(true)}
            >
              Manual Match{selectedLines.length > 0 ? ` (${selectedLines.length})` : ''}
            </ErpButton>
          ) : null}
          {useTreasuryAdjustments &&
          mergeAllowedAction(perms.canCreateAdjustmentDraft, allowedActions?.createAdjustmentDraft ?? true) ? (
            <ErpButton
              variant="secondary"
              disabled={selectedLines.length !== 1 || selectedLines[0]?.matchStatus === 'MATCHED' || selectedLines[0]?.matchStatus === 'RECONCILED'}
              disabledReason="Select exactly one unmatched or partially matched statement line"
              onClick={() => setBankTxnDrawerOpen(true)}
            >
              Create Bank Transaction
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canManageExceptions, allowedActions?.manageExceptions) ? (
            <ErpButton
              variant="secondary"
              disabled={selectedLines.length !== 1}
              disabledReason="Select exactly one line to report an exception"
              onClick={() => setExceptionPanelOpen((v) => !v)}
            >
              Report Exception
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void reload()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <PageBackLink to="/accounting/bank-cash/reconciliation" label="Back to reconciliation" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SessionStatusChip status={summary.status} />
        <span className="text-[12px] text-erp-muted">
          {workspace.statement.currencyCode} · {lines.length} lines
        </span>
      </div>

      <ReconciliationSummaryCards summary={summary} />

      {exceptionPanelOpen && selectedLines.length === 1 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-[12px] font-semibold text-amber-900">
            Report exception for line #{selectedLines[0].lineNumber}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              className="h-8 min-w-[220px] text-[12px]"
              value={exceptionReason}
              aria-label="Exception reason"
              onChange={(e) => setExceptionReason(e.target.value as BankReconciliationExceptionReason)}
            >
              {EXCEPTION_REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <input
              type="text"
              value={exceptionComment}
              onChange={(e) => setExceptionComment(e.target.value)}
              placeholder="Optional comment"
              className="h-8 flex-1 min-w-[200px] rounded border border-erp-border px-2 text-[12px]"
            />
            <ErpButton size="sm" onClick={() => void submitException()}>
              Submit
            </ErpButton>
            <ErpButton size="sm" variant="ghost" onClick={() => setExceptionPanelOpen(false)}>
              Cancel
            </ErpButton>
          </div>
        </div>
      ) : null}

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-erp-border" aria-label="Reconciliation workspace tabs">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors ${
              activeTab === tab.id ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted hover:text-erp-text'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'suggestions' ? ` (${suggestions.length})` : null}
            {tab.id === 'exceptions' ? ` (${exceptions.filter((e) => e.status === 'OPEN').length})` : null}
          </button>
        ))}
      </nav>

      <div className="mt-3">
        {activeTab === 'suggestions' ? (
          <SuggestionTable
            suggestions={suggestions}
            canAccept={mergeAllowedAction(perms.canMatch, allowedActions?.match)}
            canReject={mergeAllowedAction(perms.canMatch, allowedActions?.match)}
            busySuggestionId={busySuggestionId}
            onAccept={(s) => void onAcceptSuggestion(s)}
            onReject={(s) => void onRejectSuggestion(s)}
          />
        ) : activeTab === 'exceptions' ? (
          <ExceptionTable
            exceptions={exceptions}
            canResolve={mergeAllowedAction(perms.canManageExceptions, allowedActions?.manageExceptions)}
            busyExceptionId={busyExceptionId}
            onResolve={(ex, ref) => void onResolveException(ex, ref)}
          />
        ) : (
          <StatementLineReconTable
            lines={linesByTab}
            selectedIds={selectedLineIds}
            onToggleSelect={toggleLine}
            selectable={activeTab !== 'matched'}
            emptyMessage={`No ${activeTab} statement lines.`}
          />
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <DifferencePanel summary={summary} />
        {allowedActions ? (
          <FinalizationChecklist
            summary={summary}
            allowedActions={allowedActions}
            finalizing={finalizing}
            reopening={reopening}
            onFinalize={(force) => void onFinalize(force)}
            onReopen={(reason) => void onReopen(reason)}
          />
        ) : null}
      </div>

      <ManualMatchDrawer
        open={matchDrawerOpen}
        onClose={() => setMatchDrawerOpen(false)}
        statementId={statementId}
        selectedLines={selectedLines}
        canGroupMatch={mergeAllowedAction(perms.canGroupMatch, allowedActions?.groupMatch)}
        canPartialMatch={mergeAllowedAction(perms.canPartialMatch, allowedActions?.partialMatch)}
        onMatched={() => {
          setSelectedLineIds(new Set())
          void reload()
        }}
      />

      <CreateBankTransactionDrawer
        open={bankTxnDrawerOpen}
        onClose={() => setBankTxnDrawerOpen(false)}
        statementId={statementId}
        legalEntityId={summary.legalEntityId}
        line={selectedLines[0] ?? null}
        onCreated={() => {
          setSelectedLineIds(new Set())
          void reload()
        }}
      />
    </ReconciliationWorkspaceShell>
  )
}
