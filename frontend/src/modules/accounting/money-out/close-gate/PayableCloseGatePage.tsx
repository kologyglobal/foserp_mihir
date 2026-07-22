import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  createPayableCloseGateRun,
  getLatestPayableCloseGateRun,
  listPayableCloseGateRuns,
} from '@/services/bridges/payablesApiBridge'
import { listPeriods, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { AccountingPeriod } from '@/types/financeSetup'
import type { PayableCloseGateRunDto } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { payableCloseGateStatusTone } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableCloseGatePage() {
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [periodId, setPeriodId] = useState('')
  const [latest, setLatest] = useState<PayableCloseGateRunDto | null>(null)
  const [recentRuns, setRecentRuns] = useState<PayableCloseGateRunDto[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runFreshReconciliation, setRunFreshReconciliation] = useState(true)
  const [includeVendorLevel, setIncludeVendorLevel] = useState(true)

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === periodId) ?? null, [periodId, periods])

  const loadPeriods = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    try {
      const leId = resolveLegalEntityId()
      const rows = await listPeriods(leId)
      setPeriods(rows)
      if (!periodId && rows.length > 0) {
        const open = rows.find((p) => p.status === 'OPEN' || p.status === 'UNDER_REVIEW') ?? rows[0]
        setPeriodId(open.id)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load accounting periods')
    }
  }, [periodId])

  const loadRuns = useCallback(async () => {
    if (!isApiMode() || !periodId) return
    setLoading(true)
    try {
      const leId = resolveLegalEntityId()
      const [latestRes, listRes] = await Promise.all([
        getLatestPayableCloseGateRun(periodId, leId),
        listPayableCloseGateRuns({ legalEntityId: leId, page: 1, pageSize: 10 }),
      ])
      setLatest(latestRes?.run ?? null)
      setRecentRuns(listRes.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load close gate runs')
    } finally {
      setLoading(false)
    }
  }, [periodId])

  useEffect(() => {
    if (perms.canCloseGateView) void loadPeriods()
  }, [loadPeriods, perms.canCloseGateView])

  useEffect(() => {
    if (perms.canCloseGateView && periodId) void loadRuns()
  }, [loadRuns, periodId, perms.canCloseGateView])

  const runCloseGate = async () => {
    if (!periodId || !perms.canCloseGateRun) return
    setRunning(true)
    try {
      const run = await createPayableCloseGateRun({
        periodId,
        runFreshReconciliation,
        includeVendorLevel,
      })
      notify.success('Close gate assessment completed')
      navigate(`/accounting/money-out/close-gate/runs/${run.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to run close gate assessment')
    } finally {
      setRunning(false)
    }
  }

  if (!perms.canCloseGateView) {
    return (
      <MoneyOutWorkspaceShell title="Close Gate">
        <p className="text-[13px] text-erp-muted">You do not have permission to view AP close gate (finance.ap.close_gate.view).</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Close Gate">
        <p className="text-[13px] text-erp-muted">AP close gate requires API mode (<code>VITE_USE_API=true</code>).</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Close Gate"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/money-out/reconciliation" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            Reconciliation
          </Link>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void loadRuns()}>
            Refresh
          </ErpButton>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <label className="block text-[12px]">
          <span className="mb-1 block text-erp-muted">Accounting period</span>
          <select
            className="h-9 w-full rounded border border-erp-border px-2"
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startDate} – {p.endDate}) · {p.status}
              </option>
            ))}
          </select>
        </label>
        {selectedPeriod ? (
          <div className="rounded border border-erp-border bg-slate-50 p-3 text-[12px]">
            <p className="text-erp-muted">Period end</p>
            <p className="font-semibold text-erp-text">{selectedPeriod.endDate}</p>
          </div>
        ) : null}
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-4">
          {latest ? (
            <section className="rounded border border-erp-border bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Latest assessment</h3>
                <ErpStatusChip label={latest.status} tone={payableCloseGateStatusTone(latest.status)} />
                <span className="text-[12px] text-erp-muted">As of {latest.asOfDate}</span>
              </div>
              <p className="text-[12px] text-erp-muted">
                Checks {latest.checksPassed}/{latest.checksTotal} passed · {latest.checksWarning} warning ·{' '}
                {latest.checksBlocked} blocked · {latest.checksFailed} failed
              </p>
              <Link
                to={`/accounting/money-out/close-gate/runs/${latest.id}`}
                className="mt-2 inline-block text-[12px] font-semibold text-erp-accent hover:underline"
              >
                View assessment details →
              </Link>
            </section>
          ) : (
            <p className="text-[13px] text-erp-muted">No close gate assessments for this period yet.</p>
          )}

          {perms.canCloseGateRun ? (
            <section className="rounded border border-erp-border p-3">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Run close gate</h3>
              <div className="space-y-2 text-[12px]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={runFreshReconciliation}
                    onChange={(e) => setRunFreshReconciliation(e.target.checked)}
                  />
                  Run fresh AP reconciliation as of period end
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeVendorLevel}
                    onChange={(e) => setIncludeVendorLevel(e.target.checked)}
                  />
                  Include vendor-level reconciliation in fresh run
                </label>
              </div>
              <ErpButton className="mt-3" icon={Play} loading={running} onClick={() => void runCloseGate()}>
                Run close gate assessment
              </ErpButton>
              <p className="mt-2 text-[11px] text-erp-muted">
                Readiness assessment only — does not lock or close the accounting period.
              </p>
            </section>
          ) : null}

          {recentRuns.length > 0 ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Recent assessments</h3>
              <ul className="space-y-2 text-[12px]">
                {recentRuns.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 rounded border border-erp-border px-3 py-2">
                    <ErpStatusChip label={r.status} tone={payableCloseGateStatusTone(r.status)} />
                    <Link to={`/accounting/money-out/close-gate/runs/${r.id}`} className="text-erp-accent hover:underline">
                      {r.asOfDate}
                    </Link>
                    <span className="text-erp-muted">{r.checksPassed}/{r.checksTotal} passed</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}
