import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Link2Off, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { isApiMode } from '@/config/apiConfig'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import { mergeAllowedAction, useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import { fetchMatch, unmatch } from '../api/bank-reconciliation.api'
import type { BankReconciliationMatchDto } from '../api/bank-reconciliation.types'
import { MatchStatusChip } from '../components/BankReconciliationStatusChip'
import { ReconciliationWorkspaceShell } from '../components/ReconciliationWorkspaceShell'
import { parseDecimal } from '../utils/bankReconciliationUi'
import { useIdempotencyKey } from '../utils/idempotency'

export function ReconciliationMatchDetailPage() {
  const { matchId = '' } = useParams()
  const perms = useBankReconciliationPermissions()
  const [match, setMatch] = useState<BankReconciliationMatchDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [unmatching, setUnmatching] = useState(false)

  const resolveKey = useIdempotencyKey(`unmatch:${matchId}:${match?.updatedAt ?? ''}`)

  const load = useCallback(async () => {
    if (!matchId) return
    setLoading(true)
    try {
      setMatch(await fetchMatch(matchId))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load match')
    } finally {
      setLoading(false)
    }
  }, [matchId])

  useEffect(() => {
    if (isApiMode() && perms.canView) void load()
  }, [load, perms.canView])

  const runUnmatch = async () => {
    if (!match) return
    const reason = await appPromptNote({
      title: 'Unmatch this reconciliation match?',
      description:
        match.postingMode === 'CLEARING_SETTLEMENT'
          ? 'This will post an exact reversal of the clearing settlement entry and return the statement line and ledger entry to unmatched.'
          : 'The statement line and ledger entry will return to unmatched. No accounting entries exist to reverse.',
      tone: 'danger',
      confirmLabel: 'Unmatch',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    setUnmatching(true)
    try {
      await unmatch(match.id, { reason, idempotencyKey: resolveKey() })
      notify.success('Match unmatched')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Unmatch failed')
    } finally {
      setUnmatching(false)
    }
  }

  if (!isApiMode()) {
    return (
      <ReconciliationWorkspaceShell title="Match Detail">
        <p className="text-[13px] text-erp-muted">Match detail requires API mode.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  if (!perms.canView) {
    return (
      <ReconciliationWorkspaceShell title="Match Detail">
        <p className="text-[13px] text-erp-muted">You do not have permission to view this match.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <ReconciliationWorkspaceShell title="Match Detail">
        <LoadingState variant="form" />
      </ReconciliationWorkspaceShell>
    )
  }

  if (!match) {
    return (
      <ReconciliationWorkspaceShell title="Match Detail">
        <p className="text-[13px] text-erp-muted">Match not found.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  return (
    <ReconciliationWorkspaceShell
      title={`Match ${match.matchReference}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canUnmatch, match.allowedActions?.unmatch ?? match.matchStatus === 'ACTIVE') ? (
            <ErpButton variant="danger" icon={Link2Off} loading={unmatching} onClick={() => void runUnmatch()}>
              Unmatch
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <PageBackLink to="/accounting/bank-cash/reconciliation" label="Back to reconciliation sessions" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MatchStatusChip status={match.matchStatus} />
        <span className="text-[12px] text-erp-muted">
          {match.matchMethod.replace(/_/g, ' ')} · {match.matchSource.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-erp-border bg-white p-3">
          <p className="text-[11px] uppercase text-erp-muted">Matched amount</p>
          <p className="text-[16px] font-semibold tabular-nums">{formatCurrency(parseDecimal(match.matchedAmount))}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-white p-3">
          <p className="text-[11px] uppercase text-erp-muted">Matched at</p>
          <p className="text-[13px] font-medium">{formatDateTime(match.matchedAt)}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-white p-3">
          <p className="text-[11px] uppercase text-erp-muted">Posting mode</p>
          <p className="text-[13px] font-medium">{match.postingMode === 'CLEARING_SETTLEMENT' ? 'Clearing settlement' : 'No new posting'}</p>
        </div>
      </div>

      {match.note ? <p className="mt-3 text-[13px] text-erp-text">{match.note}</p> : null}

      <h3 className="mb-2 mt-4 text-[13px] font-semibold">Statement allocations</h3>
      <div className="overflow-auto rounded-lg border border-erp-border">
        <table className="w-full text-[12px]">
          <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
            <tr>
              <th className="px-2 py-1.5">Statement line</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {match.statementAllocations.map((a) => (
              <tr key={a.id} className="border-t border-erp-border">
                <td className="px-2 py-1.5 font-mono text-[11px]">{a.bankStatementLineId}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(parseDecimal(a.matchedAmount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-4 text-[13px] font-semibold">Ledger allocations</h3>
      <div className="overflow-auto rounded-lg border border-erp-border">
        <table className="w-full text-[12px]">
          <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
            <tr>
              <th className="px-2 py-1.5">General ledger entry</th>
              <th className="px-2 py-1.5">Source document</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {match.ledgerAllocations.map((a) => (
              <tr key={a.id} className="border-t border-erp-border">
                <td className="px-2 py-1.5 font-mono text-[11px]">{a.generalLedgerEntryId}</td>
                <td className="px-2 py-1.5">{a.sourceDocumentNumber ?? a.sourceDocumentType ?? '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(parseDecimal(a.matchedAmount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {match.matchStatus === 'REVERSED' ? (
        <div className="mt-4 rounded-md border border-erp-border bg-erp-surface-alt p-3 text-[12px]">
          <p>
            Reversed {match.reversedAt ? formatDateTime(match.reversedAt) : ''}
            {match.reversalReason ? ` — ${match.reversalReason}` : ''}
          </p>
        </div>
      ) : null}
    </ReconciliationWorkspaceShell>
  )
}
