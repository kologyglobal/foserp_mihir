/**
 * Phase 7E — live Manufacturing Accounting workspace (API mode).
 * KPI strip from /manufacturing/accounting/workspace/summary plus tabbed
 * registers for unposted / failed / provisional / close-ready / reconciliation.
 * Replaces the demo-only mock workspace when VITE_USE_API=true.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Landmark } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ManufacturingAccountingSummaryCards } from '@/components/accounting/manufacturingAccounting/ManufacturingAccountingSummaryCards'
import { Button } from '@/design-system/components/Button'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { appConfirm } from '@/store/confirmDialogStore'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDateTime } from '@/utils/dates/format'
import {
  activateCostingPolicy,
  getAccountingWorkspaceSummary,
  getManufacturingAccountingGateStatus,
  listAccountingWorkspaceCloseReady,
  listAccountingWorkspaceFailed,
  listAccountingWorkspaceProvisional,
  listAccountingWorkspaceReconciliation,
  listAccountingWorkspaceUnposted,
  listCostingPolicies,
  postManufacturingAccountingEvent,
  retryManufacturingAccountingEvent,
  setManufacturingAccountingFeatureControl,
  validateManufacturingAccountingEvent,
  type CloseReadyRow,
  type ManufacturingAccountingEvent,
  type ManufacturingAccountingGateStatus,
  type ManufacturingAccountingWorkspaceSummary,
  type ManufacturingCostingPolicy,
  type ProvisionalCostRow,
  type ReconciliationRow,
} from '@/services/api/manufacturingCostingApi'
import {
  canManageCostingPolicy,
  canPostAccounting,
  canReconcileAccounting,
  canRetryAccounting,
  canValidateAccounting,
  canViewCostingPolicy,
} from '@/utils/permissions/manufacturing'
import { hasWorkspaceAdminRole } from '@/utils/permissions/workspaceAdmin'
import { getStoredSession } from '@/services/api/client'

/** Wave 3 — enabling/disabling the MANUFACTURING_ACCOUNTING flag is a finance-settings action. */
function canManageAccountingFeatureFlag(): boolean {
  if (hasWorkspaceAdminRole()) return true
  return (getStoredSession()?.user.permissions ?? []).includes('finance.settings.manage')
}

type WorkspaceTab = 'overview' | 'unposted' | 'failed' | 'provisional' | 'close-ready' | 'reconciliation' | 'policies'

const num = (value: string | number | null | undefined) => Number(value ?? 0)

function eventStatusTone(status: string): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'POSTED') return 'success'
  if (status === 'FAILED') return 'critical'
  if (status === 'RECORDED') return 'warning'
  return 'neutral'
}

function reconciliationTone(status: ReconciliationRow['status']): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'RECONCILED') return 'success'
  if (status === 'BLOCKED') return 'critical'
  if (status === 'DIFFERENCE' || status === 'PROVISIONAL') return 'warning'
  return 'neutral'
}

function WorkOrderLink({ id, label }: { id: string | null; label?: string | null }) {
  if (!id) return <span className="text-erp-muted">—</span>
  return (
    <Link to={`/manufacturing/work-orders/${id}`} className="font-medium text-erp-primary hover:underline">
      {label ?? 'Open Work Order'}
    </Link>
  )
}

function EventTable({
  rows,
  showFailureReason,
  busy,
  onValidate,
  onPost,
  onRetry,
}: {
  rows: ManufacturingAccountingEvent[]
  showFailureReason?: boolean
  busy: boolean
  onValidate: (event: ManufacturingAccountingEvent) => void
  onPost: (event: ManufacturingAccountingEvent) => void
  onRetry: (event: ManufacturingAccountingEvent) => void
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-[13px] text-erp-muted">No accounting events in this list.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="erp-table w-full text-[12px]">
        <thead>
          <tr>
            <th>Event</th>
            <th>Work Order</th>
            <th className="text-right">Amount</th>
            <th>Status</th>
            {showFailureReason ? <th>Failure Reason</th> : null}
            <th>Recorded</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event) => (
            <tr key={event.id}>
              <td>
                <p className="font-medium">{event.eventType.replace(/_/g, ' ')}</p>
                <p className="font-mono text-[10px] text-erp-muted">{event.sourceDocumentType.replace(/_/g, ' ')}</p>
              </td>
              <td>
                <WorkOrderLink id={event.productionOrderId} label="Open Work Order" />
              </td>
              <td className="text-right tabular-nums font-semibold">{formatCurrency(num(event.amount))}</td>
              <td>
                <DynamicsStatusChip label={event.status} tone={eventStatusTone(event.status)} />
              </td>
              {showFailureReason ? (
                <td className="max-w-64 truncate text-rose-800" title={event.failureReason ?? undefined}>
                  {event.failureReason ?? '—'}
                </td>
              ) : null}
              <td className="whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  {canValidateAccounting() ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onValidate(event)}>
                      Validate
                    </Button>
                  ) : null}
                  {event.status === 'RECORDED' && canPostAccounting() ? (
                    <Button size="sm" disabled={busy} onClick={() => onPost(event)}>
                      Post
                    </Button>
                  ) : null}
                  {event.status === 'FAILED' && canRetryAccounting() ? (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRetry(event)}>
                      Retry
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ManufacturingAccountingWorkspacePage() {
  const [gate, setGate] = useState<ManufacturingAccountingGateStatus | null>(null)
  const [summary, setSummary] = useState<ManufacturingAccountingWorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<WorkspaceTab>('overview')
  const [tabLoading, setTabLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [featureBusy, setFeatureBusy] = useState(false)

  const [unposted, setUnposted] = useState<ManufacturingAccountingEvent[]>([])
  const [failed, setFailed] = useState<ManufacturingAccountingEvent[]>([])
  const [provisional, setProvisional] = useState<ProvisionalCostRow[]>([])
  const [closeReady, setCloseReady] = useState<CloseReadyRow[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>([])
  const [policies, setPolicies] = useState<ManufacturingCostingPolicy[]>([])

  const reconcileAllowed = canReconcileAccounting()
  const policiesAllowed = canViewCostingPolicy()
  const policiesManage = canManageCostingPolicy()

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const [gateRes, summaryRes] = await Promise.all([
        getManufacturingAccountingGateStatus().catch(() => null),
        getAccountingWorkspaceSummary(),
      ])
      setGate(gateRes?.data ?? null)
      setSummary(summaryRes.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load manufacturing accounting workspace')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTab = useCallback(
    async (nextTab: WorkspaceTab) => {
      if (nextTab === 'overview') return
      setTabLoading(true)
      try {
        if (nextTab === 'unposted') setUnposted((await listAccountingWorkspaceUnposted()).data)
        if (nextTab === 'failed') setFailed((await listAccountingWorkspaceFailed()).data)
        if (nextTab === 'provisional') setProvisional((await listAccountingWorkspaceProvisional()).data)
        if (nextTab === 'close-ready') setCloseReady((await listAccountingWorkspaceCloseReady()).data)
        if (nextTab === 'reconciliation' && reconcileAllowed) {
          setReconciliation((await listAccountingWorkspaceReconciliation()).data)
        }
        if (nextTab === 'policies' && policiesAllowed) {
          setPolicies((await listCostingPolicies({ limit: 100 })).data)
        }
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to load workspace list')
      } finally {
        setTabLoading(false)
      }
    },
    [reconcileAllowed, policiesAllowed],
  )

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    void loadTab(tab)
  }, [tab, loadTab])

  const refresh = useCallback(async () => {
    await Promise.all([loadSummary(), loadTab(tab)])
  }, [loadSummary, loadTab, tab])

  const handleValidate = useCallback(async (event: ManufacturingAccountingEvent) => {
    setBusy(true)
    try {
      const res = await validateManufacturingAccountingEvent(event.id)
      if (res.data.ready) {
        notify.success('Event is ready to post')
      } else {
        notify.warning(`Event not ready: ${res.data.blockers.join(', ')}`)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const handlePost = useCallback(
    async (event: ManufacturingAccountingEvent, retry: boolean) => {
      const confirmed = await appConfirm({
        title: retry ? 'Retry posting this event?' : 'Post this accounting event?',
        description: `${event.eventType.replace(/_/g, ' ')} · ${formatCurrency(num(event.amount))}. Posting creates an immutable journal voucher in the general ledger — it cannot be edited afterwards, only reversed.`,
        confirmLabel: retry ? 'Retry Post' : 'Post Event',
        tone: 'danger',
      })
      if (!confirmed) return
      setBusy(true)
      try {
        await (retry ? retryManufacturingAccountingEvent(event.id) : postManufacturingAccountingEvent(event.id))
        notify.success('Event posted')
        await refresh()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Posting failed')
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const handleToggleFeature = useCallback(
    async (enable: boolean) => {
      if (!gate?.legalEntityId) return
      const confirmed = await appConfirm({
        title: enable ? 'Enable Manufacturing Accounting?' : 'Disable Manufacturing Accounting?',
        description: enable
          ? 'Recorded manufacturing events (material issues, FG receipts, absorption) will start posting journal vouchers to the general ledger. Enabling requires account mappings and an open accounting period.'
          : 'New manufacturing events will be recorded but no longer posted to the general ledger. Already-posted vouchers are not affected.',
        confirmLabel: enable ? 'Enable' : 'Disable',
        tone: 'danger',
      })
      if (!confirmed) return
      setFeatureBusy(true)
      try {
        await setManufacturingAccountingFeatureControl(gate.legalEntityId, enable)
        notify.success(enable ? 'Manufacturing Accounting enabled' : 'Manufacturing Accounting disabled')
        await loadSummary()
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to update the Manufacturing Accounting flag')
      } finally {
        setFeatureBusy(false)
      }
    },
    [gate, loadSummary],
  )

  const handleActivatePolicy = useCallback(
    async (policy: ManufacturingCostingPolicy) => {
      if (!policiesManage) return
      const confirmed = await appConfirm({
        title: 'Activate costing policy?',
        description: `Activate “${policy.name}”? Any other ACTIVE policy in the same plant scope will be archived.`,
        confirmLabel: 'Activate',
        tone: 'danger',
      })
      if (!confirmed) return
      setBusy(true)
      try {
        await activateCostingPolicy(policy.id)
        notify.success('Costing policy activated')
        await loadTab('policies')
      } catch (e) {
        notify.error(e instanceof Error ? e.message : 'Failed to activate policy')
      } finally {
        setBusy(false)
      }
    },
    [policiesManage, loadTab],
  )

  const kpis = useMemo(
    () => [
      { id: 'unposted', label: 'Unposted', value: summary?.unpostedCount ?? 0, accent: 'amber' as const, onClick: () => setTab('unposted') },
      { id: 'failed', label: 'Failed', value: summary?.failedCount ?? 0, accent: 'red' as const, onClick: () => setTab('failed') },
      { id: 'wip', label: 'WIP Value', value: formatCurrency(num(summary?.wipValue)), accent: 'blue' as const },
      { id: 'fg-today', label: 'FG Capitalised Today', value: formatCurrency(num(summary?.fgCapitalisedToday)), accent: 'green' as const },
      { id: 'provisional', label: 'Provisional', value: summary?.provisionalCount ?? 0, accent: 'amber' as const, onClick: () => setTab('provisional') },
      { id: 'close-ready', label: 'Close-Ready', value: summary?.workOrdersReadyToClose ?? 0, accent: 'slate' as const, onClick: () => setTab('close-ready') },
    ],
    [summary],
  )

  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'unposted', label: 'Unposted' },
    { id: 'failed', label: 'Failed' },
    { id: 'provisional', label: 'Provisional' },
    { id: 'close-ready', label: 'Close Ready' },
    ...(reconcileAllowed ? [{ id: 'reconciliation' as const, label: 'Reconciliation' }] : []),
    ...(policiesAllowed ? [{ id: 'policies' as const, label: 'Policies' }] : []),
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Manufacturing Accounting"
      description="Production cost events, WIP and finished-goods postings, financial close"
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Manufacturing Accounting' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing"
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-3">
          {gate && !gate.enabled ? (
            <div className="flex flex-wrap items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                Manufacturing Accounting is <strong>not enabled</strong> for this tenant (feature flag off
                {gate.reason === 'NO_LEGAL_ENTITY' ? ' — no legal entity configured' : ''}). Events are recorded but not
                posted to the general ledger. Work-order{' '}
                <Link to="/manufacturing/work-orders" className="font-semibold underline">
                  cost calculation
                </Link>{' '}
                remains available.
              </span>
              {gate.legalEntityId && canManageAccountingFeatureFlag() ? (
                <Button size="sm" disabled={featureBusy} onClick={() => void handleToggleFeature(true)}>
                  Enable
                </Button>
              ) : null}
            </div>
          ) : null}

          {gate?.enabled && canManageAccountingFeatureFlag() ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
              <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                Manufacturing Accounting is <strong>enabled</strong> — manufacturing events post journal vouchers to the
                general ledger.
              </span>
              <Button size="sm" variant="secondary" disabled={featureBusy} onClick={() => void handleToggleFeature(false)}>
                Disable
              </Button>
            </div>
          ) : null}

          <ManufacturingAccountingSummaryCards items={kpis} activeId={tab === 'overview' ? null : tab} columns={6} />

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-erp-border bg-white p-1" role="tablist" aria-label="Manufacturing accounting tabs">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                  tab === item.id ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-slate-50 hover:text-erp-text',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'overview' ? (
            <section className="rounded-lg border border-erp-border bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold">Workspace overview</h3>
              <p className="text-[13px] text-erp-muted">
                All figures are live from recorded manufacturing accounting events and work-order cost snapshots — no
                demo data. Use the tabs above to review unposted and failed events, provisional costs, close-ready work
                orders{reconcileAllowed ? ' and the operational-vs-posted reconciliation' : ''}.
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px]">
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  <span>
                    <strong className="tabular-nums">{summary?.unpostedCount ?? 0}</strong> event(s) awaiting posting ·{' '}
                    <strong className="tabular-nums">{summary?.failedCount ?? 0}</strong> failed
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
                  <span>
                    WIP value <strong className="tabular-nums">{formatCurrency(num(summary?.wipValue))}</strong> ·
                    finished goods capitalised today{' '}
                    <strong className="tabular-nums">{formatCurrency(num(summary?.fgCapitalisedToday))}</strong>
                  </span>
                </li>
              </ul>
            </section>
          ) : null}

          {tabLoading && tab !== 'overview' ? (
            <LoadingState variant="card" />
          ) : (
            <>
              {tab === 'unposted' ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  <EventTable
                    rows={unposted}
                    busy={busy}
                    onValidate={(event) => void handleValidate(event)}
                    onPost={(event) => void handlePost(event, false)}
                    onRetry={(event) => void handlePost(event, true)}
                  />
                </section>
              ) : null}

              {tab === 'failed' ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  <EventTable
                    rows={failed}
                    showFailureReason
                    busy={busy}
                    onValidate={(event) => void handleValidate(event)}
                    onPost={(event) => void handlePost(event, false)}
                    onRetry={(event) => void handlePost(event, true)}
                  />
                </section>
              ) : null}

              {tab === 'provisional' ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  {provisional.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-erp-muted">No provisional cost snapshots.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr>
                            <th>Work Order</th>
                            <th>Status</th>
                            <th className="text-right">Provisional</th>
                            <th className="text-right">Total Actual</th>
                            <th>Snapshot</th>
                            <th>Calculated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {provisional.map((row) => (
                            <tr key={`${row.productionOrderId}-${row.snapshotVersion}`}>
                              <td>
                                <WorkOrderLink id={row.productionOrderId} label={row.productionOrder.orderNumber} />
                              </td>
                              <td>{row.productionOrder.status.replace(/_/g, ' ')}</td>
                              <td className="text-right tabular-nums font-semibold text-amber-700">
                                {formatCurrency(num(row.provisionalCost))}
                              </td>
                              <td className="text-right tabular-nums">{formatCurrency(num(row.totalActualCost))}</td>
                              <td className="tabular-nums">v{row.snapshotVersion}</td>
                              <td className="whitespace-nowrap">{formatDateTime(row.calculationDate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {tab === 'close-ready' ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  {closeReady.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-erp-muted">
                      No completed work orders with cost snapshots are ready for financial close.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr>
                            <th>Work Order</th>
                            <th>Status</th>
                            <th className="text-right">Good Qty</th>
                            <th className="text-right">Total Actual</th>
                            <th className="text-right">Posted</th>
                            <th className="text-right">Residual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closeReady.map((row) => {
                            const snapshot = row.costSnapshots[0]
                            return (
                              <tr key={row.id}>
                                <td>
                                  <WorkOrderLink id={row.id} label={row.orderNumber} />
                                </td>
                                <td>{row.status.replace(/_/g, ' ')}</td>
                                <td className="text-right tabular-nums">{num(row.completedGoodQuantity)}</td>
                                <td className="text-right tabular-nums">{snapshot ? formatCurrency(num(snapshot.totalActualCost)) : '—'}</td>
                                <td className="text-right tabular-nums">{snapshot ? formatCurrency(num(snapshot.totalPostedCost)) : '—'}</td>
                                <td className="text-right tabular-nums font-semibold">
                                  {snapshot ? formatCurrency(num(snapshot.varianceAmount)) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {tab === 'reconciliation' && reconcileAllowed ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  {reconciliation.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-erp-muted">No cost snapshots to reconcile yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr>
                            <th>Work Order</th>
                            <th className="text-right">Operational Cost</th>
                            <th className="text-right">Posted</th>
                            <th className="text-right">Difference</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reconciliation.map((row) => (
                            <tr key={row.productionOrderId}>
                              <td>
                                <WorkOrderLink id={row.productionOrderId} label={row.orderNumber} />
                              </td>
                              <td className="text-right tabular-nums">{formatCurrency(num(row.operationalCost))}</td>
                              <td className="text-right tabular-nums">{formatCurrency(num(row.postedAmount))}</td>
                              <td className="text-right tabular-nums font-semibold">{formatCurrency(num(row.difference))}</td>
                              <td>
                                <DynamicsStatusChip label={row.status} tone={reconciliationTone(row.status)} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {tab === 'policies' && policiesAllowed ? (
                <section className="rounded-lg border border-erp-border bg-white">
                  {policies.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-erp-muted">No costing policies yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="erp-table w-full text-[12px]">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Plant</th>
                            <th>Method</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {policies.map((policy) => (
                            <tr key={policy.id}>
                              <td className="font-medium">{policy.name}</td>
                              <td>{policy.plantCode ?? 'All plants'}</td>
                              <td>{policy.costingMethod.replace(/_/g, ' ')}</td>
                              <td>
                                <DynamicsStatusChip
                                  label={policy.status}
                                  tone={
                                    policy.status === 'ACTIVE'
                                      ? 'success'
                                      : policy.status === 'DRAFT'
                                        ? 'warning'
                                        : 'neutral'
                                  }
                                />
                              </td>
                              <td className="text-right">
                                {policiesManage && policy.status !== 'ACTIVE' ? (
                                  <Button size="sm" disabled={busy} onClick={() => void handleActivatePolicy(policy)}>
                                    Activate
                                  </Button>
                                ) : (
                                  <span className="text-erp-muted">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}
    </OperationalPageShell>
  )
}
