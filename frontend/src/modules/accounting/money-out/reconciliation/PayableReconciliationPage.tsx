import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  createPayableReconciliationRun,
  listPayableReconciliationRuns,
} from '@/services/bridges/payablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { PayableReconciliationRunDto } from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import {
  parseDecimal,
  payableReconciliationRunStatusTone,
  payableReconciliationStatusTone,
  todayIsoDate,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableReconciliationPage() {
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const [latest, setLatest] = useState<PayableReconciliationRunDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [asOfDate, setAsOfDate] = useState(todayIsoDate())
  const [includeVendorLevel, setIncludeVendorLevel] = useState(true)
  const [toleranceOverride, setToleranceOverride] = useState('')

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listPayableReconciliationRuns({
        legalEntityId: resolveLegalEntityId(),
        page: 1,
        pageSize: 1,
      })
      setLatest(res.items[0] ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation runs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canReconcileView) void load()
  }, [load, perms.canReconcileView])

  const runReconciliation = async () => {
    if (!perms.canReconcileRun) return
    setRunning(true)
    try {
      const run = await createPayableReconciliationRun({
        asOfDate,
        includeVendorLevel,
        ...(toleranceOverride.trim() ? { toleranceOverride: toleranceOverride.trim() } : {}),
      })
      notify.success('AP reconciliation run completed')
      navigate(`/accounting/money-out/reconciliation/runs/${run.id}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to run reconciliation')
    } finally {
      setRunning(false)
    }
  }

  if (!perms.canReconcileView) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation">
        <p className="text-[13px] text-erp-muted">
          You do not have permission to view AP reconciliation (finance.ap.reconciliation.view).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation">
        <p className="text-[13px] text-erp-muted">
          AP reconciliation requires API mode (<code>VITE_USE_API=true</code>).
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Reconciliation"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          <Link to="/accounting/money-out/reconciliation/runs" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            Run history
          </Link>
          {perms.canReconcileExceptionView ? (
            <Link
              to={
                latest
                  ? `/accounting/money-out/reconciliation/exceptions?runId=${latest.id}`
                  : '/accounting/money-out/reconciliation/exceptions'
              }
              className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              Exceptions
            </Link>
          ) : null}
          {perms.canCloseGateView ? (
            <Link to="/accounting/money-out/close-gate" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
              Close gate
            </Link>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-4">
          {latest ? (
            <section className="rounded border border-erp-border bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Latest run</h3>
                {latest.status ? (
                  <ErpStatusChip label={latest.status} tone={payableReconciliationStatusTone(latest.status)} />
                ) : (
                  <ErpStatusChip label={latest.runStatus} tone={payableReconciliationRunStatusTone(latest.runStatus)} />
                )}
                {latest.isStale ? <ErpStatusChip label="Stale" tone="warning" /> : null}
                <span className="text-[12px] text-erp-muted">As of {latest.asOfDate}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Subledger" value={formatCurrency(parseDecimal(latest.subledgerTotal))} />
                <Metric label="GL control" value={formatCurrency(parseDecimal(latest.glTotal))} />
                <Metric label="Variance" value={formatCurrency(parseDecimal(latest.variance))} />
              </div>
              <p className="mt-2 text-[12px] text-erp-muted">
                {latest.exceptionCount} exception(s) · {latest.matchedAccountCount}/{latest.controlAccountCount} accounts
                matched
              </p>
              <Link
                to={`/accounting/money-out/reconciliation/runs/${latest.id}`}
                className="mt-2 inline-block text-[12px] font-semibold text-erp-accent hover:underline"
              >
                View run details →
              </Link>
            </section>
          ) : (
            <p className="text-[13px] text-erp-muted">No reconciliation runs yet.</p>
          )}

          {perms.canReconcileRun ? (
            <section className="rounded border border-erp-border p-3">
              <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Run reconciliation</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-[12px]">
                  <span className="mb-1 block text-erp-muted">As-of date</span>
                  <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-9 text-[12px]" />
                </label>
                <label className="block text-[12px]">
                  <span className="mb-1 block text-erp-muted">Tolerance override (optional)</span>
                  <Input
                    value={toleranceOverride}
                    onChange={(e) => setToleranceOverride(e.target.value)}
                    placeholder="e.g. 0.01"
                    className="h-9 text-[12px]"
                  />
                </label>
                <label className="flex items-end gap-2 pb-1 text-[12px]">
                  <input
                    type="checkbox"
                    checked={includeVendorLevel}
                    onChange={(e) => setIncludeVendorLevel(e.target.checked)}
                  />
                  Include vendor-level reconciliation
                </label>
              </div>
              <ErpButton className="mt-3" icon={Play} loading={running} onClick={() => void runReconciliation()}>
                Run reconciliation
              </ErpButton>
            </section>
          ) : null}
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-erp-muted">{label}</p>
      <p className="text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}
