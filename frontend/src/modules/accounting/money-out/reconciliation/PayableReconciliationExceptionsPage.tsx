import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  listPayableReconciliationRunExceptions,
  listPayableReconciliationRuns,
} from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PayableReconciliationExceptionDto, PayableReconciliationExceptionSeverity } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { payableReconciliationExceptionSeverityTone } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const SEVERITIES: Array<PayableReconciliationExceptionSeverity | 'ALL'> = ['ALL', 'INFO', 'WARNING', 'ERROR', 'BLOCKER']

export function PayableReconciliationExceptionsPage() {
  const perms = useMoneyOutPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const runIdParam = searchParams.get('runId') ?? ''
  const [runId, setRunId] = useState(runIdParam)
  const [severity, setSeverity] = useState<PayableReconciliationExceptionSeverity | 'ALL'>('ALL')
  const [ackFilter, setAckFilter] = useState<'all' | 'open' | 'acknowledged'>('all')
  const [rows, setRows] = useState<PayableReconciliationExceptionDto[]>([])
  const [loading, setLoading] = useState(true)

  const queryParams = useMemo(
    () => ({
      ...(severity !== 'ALL' ? { severity } : {}),
      ...(ackFilter === 'open' ? { isAcknowledged: false } : ackFilter === 'acknowledged' ? { isAcknowledged: true } : {}),
      page: 1,
      pageSize: 100,
    }),
    [ackFilter, severity],
  )

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      let activeRunId = runId
      if (!activeRunId) {
        const latest = await listPayableReconciliationRuns({
          legalEntityId: resolveLegalEntityId(),
          page: 1,
          pageSize: 1,
        })
        activeRunId = latest.items[0]?.id ?? ''
        if (activeRunId) setRunId(activeRunId)
      }
      if (!activeRunId) {
        setRows([])
        return
      }
      const res = await listPayableReconciliationRunExceptions(activeRunId, queryParams)
      setRows(res.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation exceptions')
    } finally {
      setLoading(false)
    }
  }, [queryParams, runId])

  useEffect(() => {
    if (runIdParam && runIdParam !== runId) setRunId(runIdParam)
  }, [runId, runIdParam])

  useEffect(() => {
    if (perms.canReconcileExceptionView) void load()
  }, [load, perms.canReconcileExceptionView])

  if (!perms.canReconcileExceptionView) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation exceptions">
        <p className="text-[13px] text-erp-muted">You do not have permission to view reconciliation exceptions.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation exceptions">
        <p className="text-[13px] text-erp-muted">AP reconciliation requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Reconciliation exceptions"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/money-out/reconciliation" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            Dashboard
          </Link>
          {runId ? (
            <Link
              to={`/accounting/money-out/reconciliation/runs/${runId}`}
              className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              Run detail
            </Link>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
        <select
          className="h-9 rounded border border-erp-border px-2"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as PayableReconciliationExceptionSeverity | 'ALL')}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All severities' : s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded border border-erp-border px-2"
          value={ackFilter}
          onChange={(e) => setAckFilter(e.target.value as typeof ackFilter)}
        >
          <option value="all">All acknowledgement states</option>
          <option value="open">Open only</option>
          <option value="acknowledged">Acknowledged only</option>
        </select>
        {runId ? (
          <button
            type="button"
            className="erp-btn erp-btn-secondary h-9 px-3"
            onClick={() => setSearchParams({ runId })}
          >
            Run {runId.slice(0, 8)}…
          </button>
        ) : null}
      </div>

      {loading ? (
        <LoadingState variant="table" />
      ) : !runId ? (
        <p className="text-[13px] text-erp-muted">No reconciliation run available.</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-erp-muted">No exceptions for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-erp-muted">
                <th className="py-2 pr-2 font-medium">Severity</th>
                <th className="py-2 pr-2 font-medium">Code</th>
                <th className="py-2 pr-2 font-medium">Category</th>
                <th className="py-2 pr-2 font-medium">Message</th>
                <th className="py-2 pr-2 font-medium">Ack</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ex) => (
                <tr key={ex.id} className="border-b border-erp-border/60 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <ErpStatusChip label={ex.severity} tone={payableReconciliationExceptionSeverityTone(ex.severity)} />
                  </td>
                  <td className="py-2 pr-2">
                    <Link to={`/accounting/money-out/reconciliation/exceptions/${ex.id}`} className="text-erp-accent hover:underline">
                      {ex.code}
                    </Link>
                  </td>
                  <td className="py-2 pr-2">{ex.category.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-2">{ex.message}</td>
                  <td className="py-2 pr-2">{ex.isAcknowledged ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
