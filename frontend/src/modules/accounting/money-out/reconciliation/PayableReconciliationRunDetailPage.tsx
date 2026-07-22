import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import {
  exportPayableReconciliationRun,
  getPayableReconciliationRun,
  listPayableReconciliationRunAccounts,
  listPayableReconciliationRunExceptions,
  listPayableReconciliationRunVendors,
} from '@/services/bridges/payablesApiBridge'
import type {
  PayableReconciliationAccountResultDto,
  PayableReconciliationExceptionDto,
  PayableReconciliationRunDto,
  PayableReconciliationVendorBalanceRow,
} from '@/types/moneyOut'
import { formatCurrency } from '@/utils/formatters/currency'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { notify } from '@/store/toastStore'
import {
  downloadBlobFile,
  parseDecimal,
  payableReconciliationExceptionSeverityTone,
  payableReconciliationRunStatusTone,
  payableReconciliationStatusTone,
} from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

export function PayableReconciliationRunDetailPage() {
  const { id } = useParams()
  const perms = useMoneyOutPermissions()
  const [run, setRun] = useState<PayableReconciliationRunDto | null>(null)
  const [accounts, setAccounts] = useState<PayableReconciliationAccountResultDto[]>([])
  const [vendors, setVendors] = useState<PayableReconciliationVendorBalanceRow[]>([])
  const [exceptions, setExceptions] = useState<PayableReconciliationExceptionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!id || !isApiMode()) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [runRes, accountRes, vendorRes, exceptionRes] = await Promise.all([
        getPayableReconciliationRun(id),
        listPayableReconciliationRunAccounts(id, { page: 1, pageSize: 200 }),
        listPayableReconciliationRunVendors(id, { page: 1, pageSize: 200 }),
        listPayableReconciliationRunExceptions(id, { page: 1, pageSize: 20 }),
      ])
      setRun(runRes)
      setAccounts(accountRes.items)
      setVendors(vendorRes.items)
      setExceptions(exceptionRes.items)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reconciliation run')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canReconcileView) void load()
  }, [load, perms.canReconcileView])

  const onExport = async () => {
    if (!id || !perms.canReconcileExport) return
    setExporting(true)
    try {
      const { blob, filename } = await exportPayableReconciliationRun(id)
      downloadBlobFile(blob, filename ?? `ap-reconciliation-${id}.csv`)
      notify.success('Reconciliation export downloaded')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!perms.canReconcileView) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation run">
        <p className="text-[13px] text-erp-muted">You do not have permission to view this reconciliation run.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Reconciliation run">
        <p className="text-[13px] text-erp-muted">AP reconciliation requires API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell
      title="Reconciliation run"
      commandBar={
        <div className="flex flex-wrap gap-2">
          <Link to="/accounting/money-out/reconciliation/runs" className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]">
            All runs
          </Link>
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {perms.canReconcileExport ? (
            <ErpButton variant="secondary" icon={Download} loading={exporting} onClick={() => void onExport()}>
              Export CSV
            </ErpButton>
          ) : null}
          {perms.canReconcileExceptionView && id ? (
            <Link
              to={`/accounting/money-out/reconciliation/exceptions?runId=${id}`}
              className="erp-btn erp-btn-secondary inline-flex h-9 items-center px-3 text-[12px]"
            >
              All exceptions
            </Link>
          ) : null}
        </div>
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !run ? (
        <p className="text-[13px] text-erp-muted">Reconciliation run not found.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {run.status ? (
              <ErpStatusChip label={run.status} tone={payableReconciliationStatusTone(run.status)} />
            ) : (
              <ErpStatusChip label={run.runStatus} tone={payableReconciliationRunStatusTone(run.runStatus)} />
            )}
            {run.isStale ? <ErpStatusChip label="Stale" tone="warning" /> : null}
            <span className="text-[12px] text-erp-muted">As of {run.asOfDate}</span>
            <span className="text-[12px] text-erp-muted">Source: {run.sourceMode.replace(/_/g, ' ')}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Subledger" value={formatCurrency(parseDecimal(run.subledgerTotal))} />
            <SummaryCard label="GL control" value={formatCurrency(parseDecimal(run.glTotal))} />
            <SummaryCard label="Variance" value={formatCurrency(parseDecimal(run.variance))} />
          </div>

          <p className="text-[12px] text-erp-muted">
            Accounts {run.matchedAccountCount}/{run.controlAccountCount} matched · Exceptions {run.exceptionCount} (
            {run.blockerCount} blocker, {run.errorCount} error, {run.warningCount} warning, {run.infoCount} info)
            {run.includeVendorLevel
              ? ` · Vendors ${run.vendorCount - run.vendorMismatchCount}/${run.vendorCount} matched`
              : ''}
          </p>

          {run.limitations.length > 0 ? (
            <ul className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {run.limitations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Control accounts</h3>
            {accounts.length === 0 ? (
              <p className="text-[12px] text-erp-muted">No account results.</p>
            ) : (
              <BalanceTable
                rows={accounts.map((a) => ({
                  key: a.id,
                  label: `${a.accountCode ?? '—'} — ${a.accountName ?? 'Account'}`,
                  subledger: a.subledgerBalance,
                  gl: a.glBalance,
                  variance: a.variance,
                  matched: a.matched,
                }))}
              />
            )}
          </section>

          {run.includeVendorLevel ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Vendors</h3>
              {vendors.length === 0 ? (
                <p className="text-[12px] text-erp-muted">No vendor-level rows.</p>
              ) : (
                <BalanceTable
                  rows={vendors.map((v) => ({
                    key: v.vendorId,
                    label: `${v.vendorCode ?? '—'} — ${v.vendorName ?? 'Vendor'}`,
                    subledger: v.subledgerBalance,
                    gl: v.glBalance,
                    variance: v.variance,
                    matched: v.matched,
                  }))}
                />
              )}
            </section>
          ) : null}

          {perms.canReconcileExceptionView ? (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Recent exceptions</h3>
              {exceptions.length === 0 ? (
                <p className="text-[12px] text-erp-muted">No exceptions recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {exceptions.map((ex) => (
                    <li key={ex.id} className="rounded border border-erp-border px-3 py-2 text-[12px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <ErpStatusChip label={ex.severity} tone={payableReconciliationExceptionSeverityTone(ex.severity)} />
                        <Link to={`/accounting/money-out/reconciliation/exceptions/${ex.id}`} className="font-semibold text-erp-accent hover:underline">
                          {ex.code}
                        </Link>
                        {ex.isAcknowledged ? <span className="text-[11px] text-emerald-700">Acknowledged</span> : null}
                      </div>
                      <p className="mt-1 text-erp-text">{ex.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      )}
    </MoneyOutWorkspaceShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-erp-border bg-slate-50 p-3">
      <p className="text-[11px] uppercase text-erp-muted">{label}</p>
      <p className="text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function BalanceTable({
  rows,
}: {
  rows: Array<{ key: string; label: string; subledger: string; gl: string; variance: string; matched: boolean }>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-erp-border text-erp-muted">
            <th className="py-2 pr-2">Name</th>
            <th className="py-2 pr-2 text-right">Subledger</th>
            <th className="py-2 pr-2 text-right">GL</th>
            <th className="py-2 pr-2 text-right">Variance</th>
            <th className="py-2">Matched</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-erp-border/60">
              <td className="py-2 pr-2">{r.label}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.subledger))}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.gl))}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(parseDecimal(r.variance))}</td>
              <td className="py-2">{r.matched ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
