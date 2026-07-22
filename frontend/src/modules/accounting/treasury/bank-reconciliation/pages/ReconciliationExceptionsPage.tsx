import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { isApiMode } from '@/config/apiConfig'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { notify } from '@/store/toastStore'
import { useBankReconciliationPermissions } from '@/utils/permissions/bankReconciliation'
import { fetchReconciliationExceptionsGlobal, resolveException } from '../api/bank-reconciliation.api'
import type { ExceptionDto } from '../api/bank-reconciliation.types'
import { ExceptionTable } from '../components/ExceptionTable'
import { ReconciliationWorkspaceShell } from '../components/ReconciliationWorkspaceShell'

/** Global open/resolved exception queue across all bank accounts — `/accounting/bank-cash/reconciliation/exceptions`. */
export function ReconciliationExceptionsPage() {
  const perms = useBankReconciliationPermissions()
  const [rows, setRows] = useState<ExceptionDto[]>([])
  const [status, setStatus] = useState<'' | 'OPEN' | 'RESOLVED'>('OPEN')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyExceptionId, setBusyExceptionId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchReconciliationExceptionsGlobal({
        legalEntityId: resolveLegalEntityId(),
        status: status || undefined,
        page: 1,
        limit: 50,
      })
      setRows(list.items)
      setTotal(list.total)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation exceptions')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (isApiMode() && perms.canView) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms.canView, status])

  const onResolve = async (exception: ExceptionDto, resolutionReference: string) => {
    setBusyExceptionId(exception.id)
    try {
      await resolveException(exception.id, { resolutionReference: resolutionReference || undefined })
      notify.success('Exception resolved')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to resolve exception')
    } finally {
      setBusyExceptionId(null)
    }
  }

  if (!isApiMode()) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation Exceptions">
        <p className="text-[13px] text-erp-muted">Reconciliation exceptions require API mode.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  if (!perms.canView) {
    return (
      <ReconciliationWorkspaceShell title="Reconciliation Exceptions">
        <p className="text-[13px] text-erp-muted">You do not have permission to view bank reconciliation exceptions.</p>
      </ReconciliationWorkspaceShell>
    )
  }

  return (
    <ReconciliationWorkspaceShell
      title="Reconciliation Exceptions"
      description="Statement lines flagged as unresolvable during reconciliation — duplicates, unidentified deposits, and bank errors."
      actions={
        <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
          Refresh
        </ErpButton>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Select
          className="h-9 min-w-[150px] text-[12px]"
          value={status}
          aria-label="Exception status"
          onChange={(e) => setStatus(e.target.value as '' | 'OPEN' | 'RESOLVED')}
        >
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="">All</option>
        </Select>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}

      {!loading ? (
        <EnterpriseRegisterTableShell>
          <ExceptionTable
            exceptions={rows}
            canResolve={perms.canManageExceptions}
            busyExceptionId={busyExceptionId}
            onResolve={(ex, ref) => void onResolve(ex, ref)}
            emptyMessage="No reconciliation exceptions in this filter."
          />
        </EnterpriseRegisterTableShell>
      ) : null}

      {!loading && total > rows.length ? <p className="mt-3 text-[12px] text-erp-muted">{total} total exceptions.</p> : null}
    </ReconciliationWorkspaceShell>
  )
}
