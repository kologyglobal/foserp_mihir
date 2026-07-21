import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { exportPayableCloseGateRun, getPayableCloseGateRun } from '@/services/bridges/payablesApiBridge'
import type { PayableCloseGateCheckDto, PayableCloseGateRunDto } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import { downloadBlobFile, payableCloseGateCheckStatusTone, payableCloseGateStatusTone } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableCloseGateRunDetailPage() {
  const { id } = useParams()
  const perms = useMoneyOutPermissions()
  const [run, setRun] = useState<PayableCloseGateRunDto | null>(null)
  const [checks, setChecks] = useState<PayableCloseGateCheckDto[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await getPayableCloseGateRun(id)
      setRun(res.run)
      setChecks(res.checks)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load close gate run')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canCloseGateView) void load()
  }, [load, perms.canCloseGateView])

  const onExport = async () => {
    if (!id || !perms.canCloseGateExport) return
    setExporting(true)
    try {
      const { blob, filename } = await exportPayableCloseGateRun(id)
      downloadBlobFile(blob, filename ?? `ap-close-gate-${id}.csv`)
      notify.success('Close gate export downloaded')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!perms.canCloseGateView) {
    return (
      <MoneyOutWorkspaceShell title="Close gate run">
        <p className="text-[13px] text-erp-muted">You do not have permission to view close gate assessments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Close gate run">
        <p className="text-[13px] text-erp-muted">AP close gate requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Close gate run"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/money-out/close-gate" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            Close gate
          </Link>
          {run?.reconciliationRunId ? (
            <Link
              to={`/accounting/money-out/reconciliation/runs/${run.reconciliationRunId}`}
              className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              Linked reconciliation
            </Link>
          ) : null}
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {perms.canCloseGateExport ? (
            <ErpButton variant="secondary" icon={Download} loading={exporting} onClick={() => void onExport()}>
              Export CSV
            </ErpButton>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !run ? (
        <p className="text-[13px] text-erp-muted">Close gate run not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ErpStatusChip label={run.status} tone={payableCloseGateStatusTone(run.status)} />
            <span className="text-[12px] text-erp-muted">As of {run.asOfDate}</span>
            <span className="text-[12px] text-erp-muted">
              Completed {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Passed" value={run.checksPassed} />
            <Stat label="Warning" value={run.checksWarning} />
            <Stat label="Blocked" value={run.checksBlocked} />
            <Stat label="Failed" value={run.checksFailed} />
          </div>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Checks</h3>
            {checks.length === 0 ? (
              <p className="text-[12px] text-erp-muted">No checks recorded.</p>
            ) : (
              <ul className="space-y-2">
                {checks.map((c) => (
                  <li key={c.id} className="rounded border border-erp-border px-3 py-2 text-[12px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <ErpStatusChip label={c.status} tone={payableCloseGateCheckStatusTone(c.status)} />
                      <span className="font-semibold text-erp-text">{c.checkName}</span>
                      <span className="text-[11px] text-erp-muted">{c.checkCode}</span>
                    </div>
                    <p className="mt-1 text-erp-text">{c.message}</p>
                    {c.details ? (
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[11px]">
                        {JSON.stringify(c.details, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3">
      <p className="text-[11px] uppercase text-erp-muted">{label}</p>
      <p className="text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}
