import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import { fetchTreasuryBankAccounts } from '../../bank-statements/api/bank-statement.api'
import type { TreasuryAccountSummary } from '../../bank-statements/api/bank-statement.types'
import { fetchReconciliationSessions } from '../api/bank-reconciliation.api'
import type { BankReconciliationSessionStatus, SessionDto } from '../api/bank-reconciliation.types'
import { SessionStatusChip } from '../components/BankReconciliationStatusChip'
import { ReconciliationWorkspaceShell } from '../components/ReconciliationWorkspaceShell'
import { SESSION_STATUS_LABELS, parseDecimal } from '../utils/bankReconciliationUi'

const STATUS_OPTIONS: Array<{ value: '' | BankReconciliationSessionStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(SESSION_STATUS_LABELS).map(([value, label]) => ({ value: value as BankReconciliationSessionStatus, label })),
]

export function ApiReconciliationListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useBankReconciliationPermissions()
  const [rows, setRows] = useState<SessionDto[]>([])
  const [accounts, setAccounts] = useState<TreasuryAccountSummary[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<'' | BankReconciliationSessionStatus>(
    (searchParams.get('status') as BankReconciliationSessionStatus) || '',
  )
  const [treasuryAccountId, setTreasuryAccountId] = useState(searchParams.get('treasuryAccountId') || '')
  const [loading, setLoading] = useState(true)

  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, accts] = await Promise.all([
        fetchReconciliationSessions({
          legalEntityId,
          status: status || undefined,
          treasuryAccountId: treasuryAccountId || undefined,
          page: 1,
          limit: 50,
        }),
        accounts.length ? Promise.resolve({ items: accounts }) : fetchTreasuryBankAccounts(legalEntityId),
      ])
      setRows(list.items)
      setTotal(list.total)
      if (!accounts.length) setAccounts(accts.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation sessions')
    } finally {
      setLoading(false)
    }
  }, [accounts.length, legalEntityId, status, treasuryAccountId])

  useEffect(() => {
    if (perms.canView) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms.canView, status, treasuryAccountId])

  const accountLabel = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, `${a.code} — ${a.name}`]))
    return (id: string) => map.get(id) ?? id.slice(0, 8)
  }, [accounts])

  if (!perms.canView) {
    return (
      <ReconciliationWorkspaceShell title="Bank Reconciliation">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank reconciliation.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  return (
    <ReconciliationWorkspaceShell
      title="Bank Reconciliation"
      actions={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          className="h-9 min-w-[180px] text-[12px]"
          value={treasuryAccountId}
          aria-label="Bank account"
          onChange={(e) => {
            setTreasuryAccountId(e.target.value)
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              if (e.target.value) next.set('treasuryAccountId', e.target.value)
              else next.delete('treasuryAccountId')
              return next
            })
          }}
        >
          <option value="">All bank accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[170px] text-[12px]"
          value={status}
          aria-label="Status"
          onChange={(e) => {
            const v = e.target.value as '' | BankReconciliationSessionStatus
            setStatus(v)
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              if (v) next.set('status', v)
              else next.delete('status')
              return next
            })
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading && rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-erp-border bg-white p-6 text-center">
          <p className="text-[13px] text-erp-muted">No reconciliation sessions yet.</p>
          <p className="mt-1 text-[12px] text-erp-muted">
            Sessions are created automatically the first time you open a validated bank statement's reconciliation workspace.
          </p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <EnterpriseRegisterTableShell>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase text-erp-muted">
                <th className="px-2 py-1.5">Bank account</th>
                <th className="px-2 py-1.5">Period</th>
                <th className="px-2 py-1.5 text-right">Closing balance</th>
                <th className="px-2 py-1.5 text-right">Unmatched</th>
                <th className="px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border hover:bg-erp-surface/40">
                  <td className="px-2 py-1.5">
                    <TableLink to={`/accounting/bank-cash/reconciliation/${row.bankStatementId}`}>
                      {accountLabel(row.treasuryAccountId)}
                    </TableLink>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatDate(row.statementStartDate)} – {formatDate(row.statementEndDate)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {row.statementClosingBalance != null ? formatCurrency(parseDecimal(row.statementClosingBalance)) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(parseDecimal(row.unmatchedStatementAmount))}</td>
                  <td className="px-2 py-1.5">
                    <SessionStatusChip status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </EnterpriseRegisterTableShell>
      ) : null}

      {!loading && total > rows.length ? (
        <p className="mt-3 text-[12px] text-erp-muted">{total} total sessions.</p>
      ) : null}
    </ReconciliationWorkspaceShell>
  )
}
