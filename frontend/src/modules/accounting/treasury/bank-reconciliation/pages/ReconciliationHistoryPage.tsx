import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { isApiMode } from '@/config/apiConfig'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import { fetchTreasuryBankAccounts } from '../../bank-statements/api/bank-statement.api'
import type { TreasuryAccountSummary } from '../../bank-statements/api/bank-statement.types'
import { fetchReconciliationHistory } from '../api/bank-reconciliation.api'
import type { SessionDto } from '../api/bank-reconciliation.types'
import { HistoryTable } from '../components/HistoryTable'
import { ReconciliationWorkspaceShell } from '../components/ReconciliationWorkspaceShell'

/** Finalized / reopened reconciliation sessions across bank accounts — `/accounting/bank-cash/reconciliation/history`. */
export function ReconciliationHistoryPage() {
  const perms = useBankReconciliationPermissions()
  const [rows, setRows] = useState<SessionDto[]>([])
  const [accounts, setAccounts] = useState<TreasuryAccountSummary[]>([])
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, accts] = await Promise.all([
        fetchReconciliationHistory({
          legalEntityId,
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
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation history')
    } finally {
      setLoading(false)
    }
  }, [accounts.length, legalEntityId, treasuryAccountId])

  useEffect(() => {
    if (isApiMode() && perms.canView) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms.canView, treasuryAccountId])

  if (!isApiMode()) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation History">
        <p className="text-[13px] text-erp-muted">Reconciliation history requires API mode.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  if (!perms.canView) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation History">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank reconciliation history.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  return (
    <ReconciliationWorkspaceShell
      title="Reconciliation History"
      description="Finalized and reopened reconciliation sessions across all bank accounts."
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
          onChange={(e) => setTreasuryAccountId(e.target.value)}
        >
          <option value="">All bank accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading ? (
        <EnterpriseRegisterTableShell>
          <HistoryTable sessions={rows} />
        </EnterpriseRegisterTableShell>
      ) : null}

      {!loading && total > rows.length ? <p className="mt-3 text-[12px] text-erp-muted">{total} total sessions.</p> : null}
    </ReconciliationWorkspaceShell>
  )
}
