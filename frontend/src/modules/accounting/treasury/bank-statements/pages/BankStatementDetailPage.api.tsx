import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Edit, RefreshCw, Scale, XCircle } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { PageBackLink } from '@/components/ui/PageBackLink'
import { appPromptNote } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { mergeAllowedAction, useTreasuryStatementPermissions } from '@/utils/permissions/treasuryStatement'
import { useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import { RECONCILABLE_STATEMENT_STATUSES } from '../../bank-reconciliation/utils/bankReconciliationUi'
import {
  cancelStatement,
  fetchBankStatement,
  reopenStatementDraft,
  validateStatement,
} from '../api/bank-statement.api'
import type { BankStatementDetail, BankStatementListItem } from '../api/bank-statement.types'
import { BankStatementStatusChip } from '../components/BankStatementStatusChip'
import { StatementBalanceSummary } from '../components/StatementBalanceSummary'
import { StatementLineGrid } from '../components/StatementLineGrid'
import { BankStatementWorkspaceShell } from '../components/BankStatementWorkspaceShell'
import { parseDecimal } from '../utils/bankStatementUi'

export function ApiBankStatementDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useTreasuryStatementPermissions()
  const reconPerms = useBankReconciliationPermissions()
  const [detail, setDetail] = useState<BankStatementDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setDetail(await fetchBankStatement(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load statement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canView && id) void load()
  }, [id, load, perms.canView])

  const runValidate = async (stmt: BankStatementListItem) => {
    try {
      const updated = await validateStatement(stmt.id, { expectedUpdatedAt: stmt.updatedAt })
      notify.success(updated.status === 'VALIDATED' ? 'Statement validated' : 'Validation completed with issues')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    }
  }

  const runCancel = async (stmt: BankStatementListItem) => {
    const reason = await appPromptNote({
      title: 'Cancel bank statement?',
      description: 'Reason for cancellation',
      tone: 'danger',
      confirmLabel: 'Cancel statement',
      note: { required: true, label: 'Reason' },
    })
    if (reason === null) return
    try {
      await cancelStatement(stmt.id, { expectedUpdatedAt: stmt.updatedAt, reason })
      notify.success('Statement cancelled')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  const runReopen = async (stmt: BankStatementListItem) => {
    try {
      await reopenStatementDraft(stmt.id, { expectedUpdatedAt: stmt.updatedAt })
      notify.success('Reopened to draft')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reopen failed')
    }
  }

  if (!perms.canView) {
    return (
      <BankStatementWorkspaceShell title="Bank Statement">
        <p className="text-[13px] text-erp-muted">You do not have permission to view this statement.</p>
      </BankStatementWorkspaceShell>
    )
  }

  if (loading) return <LoadingState variant="form" className="mt-4" />
  if (!detail) {
    return (
      <BankStatementWorkspaceShell title="Bank Statement">
        <p className="text-[13px] text-erp-muted">Statement not found.</p>
      </BankStatementWorkspaceShell>
    )
  }

  const stmt = detail.statement
  const header = {
    statementReference: stmt.statementReference,
    statementDate: stmt.statementDate,
    periodStartDate: stmt.periodStartDate,
    periodEndDate: stmt.periodEndDate,
    openingBalance: stmt.openingBalance,
    closingBalance: stmt.closingBalance,
    totalCreditAmount: stmt.totalCreditAmount,
    totalDebitAmount: stmt.totalDebitAmount,
    balanceDifference: stmt.balanceDifference,
  }

  return (
    <BankStatementWorkspaceShell
      title={stmt.statementReference}
      actions={
        <div className="flex flex-wrap gap-2">
          {mergeAllowedAction(perms.canEdit, stmt.allowedActions.canEdit) ? (
            <ErpButton variant="secondary" icon={Edit} onClick={() => navigate(`/accounting/bank-cash/statements/${stmt.id}/edit`)}>
              Edit
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canValidate, stmt.allowedActions.canValidate) ? (
            <ErpButton icon={CheckCircle} onClick={() => void runValidate(stmt)}>
              Validate
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canEdit, stmt.allowedActions.canReopenDraft) ? (
            <ErpButton variant="secondary" onClick={() => void runReopen(stmt)}>
              Reopen draft
            </ErpButton>
          ) : null}
          {mergeAllowedAction(perms.canCancel, stmt.allowedActions.canCancel) ? (
            <ErpButton variant="secondary" icon={XCircle} onClick={() => void runCancel(stmt)}>
              Cancel
            </ErpButton>
          ) : null}
          {reconPerms.canView && RECONCILABLE_STATEMENT_STATUSES.includes(stmt.status) ? (
            <ErpButton icon={Scale} onClick={() => navigate(`/accounting/bank-cash/reconciliation/${stmt.id}`)}>
              Open Reconciliation
            </ErpButton>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <PageBackLink to="/accounting/bank-cash/statements" label="Back to statements" className="mb-3" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <BankStatementStatusChip status={stmt.status} />
        <span className="text-[12px] text-erp-muted">
          {formatDate(stmt.statementDate)} · {stmt.lineCount} lines · {stmt.importFormat}
        </span>
        {stmt.importBatchId ? (
          <Link
            to={`/accounting/bank-cash/import-batches/${stmt.importBatchId}`}
            className="text-[12px] font-semibold text-erp-primary"
          >
            View import batch
          </Link>
        ) : null}
      </div>

      <StatementBalanceSummary header={header} currencyCode={stmt.currencyCode} />

      <div className="mt-4 grid gap-2 text-[12px] sm:grid-cols-3">
        <div>
          <span className="text-erp-muted">Balance difference</span>
          <p className="font-medium tabular-nums">{formatCurrency(parseDecimal(stmt.balanceDifference))}</p>
        </div>
        <div>
          <span className="text-erp-muted">Source</span>
          <p className="font-medium">{stmt.sourceType}</p>
        </div>
        <div>
          <span className="text-erp-muted">Updated</span>
          <p className="font-medium">{formatDate(stmt.updatedAt)}</p>
        </div>
      </div>

      <h2 className="mb-2 mt-4 text-[13px] font-semibold">Statement lines</h2>
      <StatementLineGrid rows={detail.lines} currencyCode={stmt.currencyCode} maxHeight="32rem" />
    </BankStatementWorkspaceShell>
  )
}
