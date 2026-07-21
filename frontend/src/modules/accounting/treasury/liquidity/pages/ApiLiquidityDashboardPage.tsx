import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { FinanceLegalEntitySwitcher } from '@/modules/accounting/settings/FinanceLegalEntitySwitcher'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { useTreasuryAdjustmentPermissions } from '@/utils/permissions/treasuryAdjustment'
import {
  closeDayClose,
  createDayClose,
  fetchTreasuryDashboard,
  reopenDayClose,
  reviewDayClose,
} from '../api/treasury-liquidity.api'
import type { TreasuryDashboardResult } from '../api/treasury-liquidity.types'
import { parseDecimal } from '../../books/utils/format'

const SEVERITY = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
} as const

/** API-mode treasury liquidity dashboard — cash position, forecast, closing controls (Phase 5C1). */
export function ApiLiquidityDashboardPage() {
  const navigate = useNavigate()
  const perms = useTreasuryAdjustmentPermissions()
  const [params, setParams] = useSearchParams()
  const legalEntityId = useMemo(() => resolveLegalEntityId(), [])
  const asOfDate = params.get('asOfDate') ?? new Date().toISOString().slice(0, 10)
  const horizonDays = Number(params.get('horizonDays') ?? 30)

  const [data, setData] = useState<TreasuryDashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!legalEntityId || !perms.canViewLiquidity) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await fetchTreasuryDashboard({ legalEntityId, asOfDate, horizonDays })
      setData(result)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load treasury liquidity dashboard')
    } finally {
      setLoading(false)
    }
  }, [legalEntityId, asOfDate, horizonDays, perms.canViewLiquidity])

  useEffect(() => {
    void load()
  }, [load])

  const dayClose = data?.closingControls.dayClose
  const dayCloseStatus = dayClose?.status

  const onCloseDay = async () => {
    if (!legalEntityId || !data || !perms.canManageClosing) return
    setBusy(true)
    try {
      let dayCloseId = data.closingControls.dayClose?.id
      let updatedAt = data.closingControls.dayClose?.updatedAt
      if (!dayCloseId) {
        const created = await createDayClose({ legalEntityId, closeDate: asOfDate })
        dayCloseId = created.id
        updatedAt = created.updatedAt
      }
      if (!updatedAt) throw new Error('Missing day-close version')
      if (data.closingControls.dayClose?.status === 'OPEN' || !data.closingControls.dayClose) {
        const reviewed = await reviewDayClose(dayCloseId, { expectedUpdatedAt: updatedAt })
        updatedAt = reviewed.updatedAt
      }
      await closeDayClose(dayCloseId, { expectedUpdatedAt: updatedAt })
      notify.success('Treasury day closed (soft close — GL remains open)')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Day close failed')
    } finally {
      setBusy(false)
    }
  }

  const onReopenDay = async () => {
    if (!dayClose || !perms.canManageClosing) return
    const reason = window.prompt('Reason to reopen this treasury day close?')
    if (!reason?.trim()) return
    setBusy(true)
    try {
      await reopenDayClose(dayClose.id, { expectedUpdatedAt: dayClose.updatedAt, reason: reason.trim() })
      notify.success('Treasury day reopened')
      void load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reopen failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewLiquidity) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Treasury Liquidity"
        description="You do not have permission to view treasury liquidity."
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Bank & Cash', to: '/accounting/bank-cash' },
          { label: 'Liquidity' },
        ]}
        autoBreadcrumbs={false}
        favoritePath="/accounting/bank-cash/liquidity"
      >
        <BankCashWorkspaceTabs active="liquidity" />
        <p className="mt-4 text-[13px] text-erp-muted">Requires `finance.treasury.liquidity.view`.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Treasury Liquidity"
      description="Live cash position, short-term liquidity forecast and bank/cash closing controls."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Bank & Cash', to: '/accounting/bank-cash' },
        { label: 'Liquidity' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/liquidity"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <FinanceLegalEntitySwitcher />
          <input
            type="date"
            className="h-8 rounded border border-erp-border px-2 text-[12px]"
            value={asOfDate}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              next.set('asOfDate', e.target.value)
              setParams(next, { replace: true })
            }}
            aria-label="As of date"
          />
          <ErpButton variant="secondary" icon={RefreshCw} onClick={() => void load()}>
            Refresh
          </ErpButton>
          {perms.canManageClosing && dayCloseStatus === 'CLOSED' ? (
            <ErpButton variant="outline" loading={busy} onClick={() => void onReopenDay()}>
              Reopen Day
            </ErpButton>
          ) : null}
          {perms.canManageClosing ? (
            <ErpButton
              loading={busy}
              disabled={!data?.closingControls.readyToClose || dayCloseStatus === 'CLOSED'}
              onClick={() => void onCloseDay()}
            >
              Close Day
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <BankCashWorkspaceTabs active="liquidity" />
      {loading || !data ? (
        <LoadingState variant="dashboard" />
      ) : (
        <div className="mt-3 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Book bank" value={formatCurrency(parseDecimal(data.position.totalBankBalance))} />
            <Kpi label="Book cash" value={formatCurrency(parseDecimal(data.position.totalCashBalance))} />
            <Kpi label="Available liquidity" value={formatCurrency(parseDecimal(data.liquidity.availableLiquidity))} />
            <Kpi
              label="30d projected"
              value={formatCurrency(
                parseDecimal(
                  data.forecast.buckets.find((b) => b.horizonDays === 30)?.projectedClosing
                    ?? data.forecast.buckets.at(-1)?.projectedClosing
                    ?? data.liquidity.availableLiquidity,
                ),
              )}
            />
          </div>

          {data.liquidity.warnings.length > 0 ? (
            <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              {data.liquidity.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <section className="rounded-lg border border-erp-border bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Cash position</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="text-erp-muted">
                  <tr>
                    <th className="px-2 py-1">Account</th>
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1 text-right">Book balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.position.accounts.map((a) => (
                    <tr key={a.treasuryAccountId} className="border-t border-erp-border/60">
                      <td className="px-2 py-1.5">
                        <span className="font-medium text-erp-text">{a.code}</span>
                        <span className="ml-2 text-erp-muted">{a.name}</span>
                      </td>
                      <td className="px-2 py-1.5">{a.accountType}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(parseDecimal(a.bookBalance))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Forecast horizons</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.forecast.buckets.map((b) => (
                <div key={b.horizonDays} className="rounded border border-erp-border/70 p-2 text-[12px]">
                  <p className="font-semibold text-erp-text">{b.horizonDays}-day</p>
                  <p className="text-erp-muted">In {formatCurrency(parseDecimal(b.inflow))}</p>
                  <p className="text-erp-muted">Out {formatCurrency(parseDecimal(b.outflow))}</p>
                  <p className="mt-1 tabular-nums font-medium">Close {formatCurrency(parseDecimal(b.projectedClosing))}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold text-erp-text">Closing controls</h2>
              <span className="text-[11px] text-erp-muted">
                {data.closingControls.readyToClose ? 'Ready to close' : 'Resolve warnings before close'}
                {data.closingControls.dayClose ? ` · ${data.closingControls.dayClose.status}` : ''}
              </span>
            </div>
            <div className="space-y-2">
              {data.closingControls.items.map((item) => (
                <div key={item.id} className={`rounded border px-3 py-2 text-[12px] ${SEVERITY[item.severity]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.label}</p>
                    {item.href ? (
                      <Link to={item.href} className="underline">
                        Open
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-0.5 opacity-90">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-erp-border bg-white p-3">
            <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Workflow snapshot</h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-[12px]">
              <Stat label="In transit" value={data.workflow.transfersInTransit} onClick={() => navigate('/accounting/bank-cash/transfers/in-transit')} />
              <Stat label="Transfer approvals" value={data.workflow.transfersPendingApproval} onClick={() => navigate('/accounting/bank-cash/transfers?status=PENDING_APPROVAL')} />
              <Stat label="Uncleared cheques" value={data.workflow.chequesUncleared} onClick={() => navigate('/accounting/bank-cash/cheques')} />
              <Stat label="Adj. ready" value={data.workflow.adjustmentsReadyToPost} onClick={() => navigate('/accounting/bank-cash/treasury-adjustments?status=READY_TO_POST')} />
              <Stat label="Open recon" value={data.workflow.openReconciliationSessions} onClick={() => navigate('/accounting/bank-cash/reconciliation')} />
              <Stat label="SI due" value={data.workflow.standingInstructionsDue} onClick={() => navigate('/accounting/bank-cash/standing-instructions')} />
            </div>
          </section>
        </div>
      )}
    </OperationalPageShell>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white p-3">
      <p className="text-[11px] text-erp-muted">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-erp-text">{value}</p>
    </div>
  )
}

function Stat({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded border border-erp-border px-2 py-2 text-left hover:bg-erp-surface">
      <p className="text-erp-muted">{label}</p>
      <p className="text-[15px] font-semibold tabular-nums">{value}</p>
    </button>
  )
}
