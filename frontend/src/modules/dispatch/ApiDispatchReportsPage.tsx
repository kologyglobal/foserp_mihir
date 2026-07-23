import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, RefreshCw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { SectionCard } from '../../components/ui/SectionCard'
import { TableLink } from '../../components/ui/AppLink'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../design-system/components/LoadingState'
import { formatDate } from '../../utils/dates/format'
import { notify } from '../../store/toastStore'
import {
  getDispatchWorkbenchSummary,
  listDispatchRequirements,
  listOutboundDispatches,
  type DispatchRequirementListItem,
  type DispatchWorkbenchSummary,
  type OutboundDispatch,
} from '../../services/api/dispatchApi'

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function KpiTile({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const body = (
    <div className="rounded-lg border border-erp-border bg-white px-3 py-2">
      <p className="text-[11px] font-medium text-erp-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-erp-text">{value}</p>
    </div>
  )
  return to ? <Link to={to} className="block hover:opacity-90">{body}</Link> : body
}

/**
 * Live dispatch reports (API mode) — sourced from the 7C1 requirements
 * workbench and 7C0 outbound register. POD is on posted outbound detail (`DispatchPodPanel`).
 */
export function ApiDispatchReportsPage() {
  const [summary, setSummary] = useState<DispatchWorkbenchSummary | null>(null)
  const [ready, setReady] = useState<DispatchRequirementListItem[]>([])
  const [pendingDrafts, setPendingDrafts] = useState<OutboundDispatch[]>([])
  const [dispatchedMonth, setDispatchedMonth] = useState<OutboundDispatch[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Settle independently so one flaky call (e.g. mid backend restart) does not blank the page.
      const [sumR, readyR, draftsR, confirmedR] = await Promise.allSettled([
        getDispatchWorkbenchSummary(),
        listDispatchRequirements({ tab: 'ready', limit: 50 }),
        listOutboundDispatches({ status: 'DRAFT', limit: 50 }),
        listOutboundDispatches({ status: 'CONFIRMED', limit: 100 }),
      ])
      if (sumR.status === 'fulfilled') setSummary(sumR.value)
      if (readyR.status === 'fulfilled') setReady(readyR.value.items)
      if (draftsR.status === 'fulfilled') setPendingDrafts(draftsR.value.items)
      if (confirmedR.status === 'fulfilled') {
        const from = monthStartIso()
        setDispatchedMonth(confirmedR.value.items.filter((d) => (d.confirmedAt ?? '') >= from))
      }
      const failed = [sumR, readyR, draftsR, confirmedR].filter((r) => r.status === 'rejected')
      if (failed.length === 4) {
        notify.error('Could not load dispatch reports')
      } else if (failed.length > 0) {
        notify.error('Some dispatch report panels could not load — try Refresh')
      }
    } catch {
      notify.error('Could not load dispatch reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="erp-page">
      <PageHeader
        title="Dispatch Reports"
        description="Ready · Pending · Dispatched this month — live operational data"
        breadcrumbs={[{ label: 'Dispatch', to: '/dispatch' }, { label: 'Reports' }]}
        actions={(
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
      />

      <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
        <span>Deeper dispatch analytics (readiness ageing, SO fulfilment) run through the ops report runner.</span>
        <Link to="/manufacturing/reports/dispatch-readiness" className="whitespace-nowrap font-semibold text-erp-primary hover:underline">
          Open Dispatch Readiness report →
        </Link>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Ready to Dispatch" value={summary?.readyToDispatch ?? 0} to="/dispatch/workbench" />
            <KpiTile label="Waiting (Production / QC / Stock)" value={(summary?.waitingForProduction ?? 0) + (summary?.waitingForQuality ?? 0) + (summary?.waitingForStock ?? 0)} to="/dispatch/workbench" />
            <KpiTile label="Draft Dispatches" value={summary?.draftDispatches ?? 0} to="/dispatch/register" />
            <KpiTile label="Dispatched This Month" value={dispatchedMonth.length} to="/dispatch/register" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Ready to Dispatch" noPadding>
              {ready.length === 0 ? (
                <div className="p-6"><EmptyState icon={Package} title="Nothing ready to dispatch" /></div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Requirement</th><th>SO</th><th>Customer</th><th>Item</th><th className="text-right">Ready Qty</th></tr></thead>
                  <tbody>
                    {ready.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono">{r.requirementNumber}</td>
                        <td>{r.salesOrderNo}</td>
                        <td>{r.customerName ?? '—'}</td>
                        <td>{r.itemCode ? `${r.itemCode} — ${r.itemName ?? ''}` : r.productOrItem}</td>
                        <td className="text-right tabular-nums">{r.readyQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard title="Pending Dispatch (Drafts)" noPadding>
              {pendingDrafts.length === 0 ? (
                <div className="p-6"><EmptyState icon={Package} title="No draft dispatches" /></div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Dispatch</th><th>SO</th><th>Planned Date</th></tr></thead>
                  <tbody>
                    {pendingDrafts.map((d) => (
                      <tr key={d.id}>
                        <td><TableLink to={`/dispatch/${d.id}`}>{d.dispatchNo}</TableLink></td>
                        <td>{d.salesOrderNo ?? '—'}</td>
                        <td>{d.plannedDispatchDate ? formatDate(d.plannedDispatchDate) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard title="Dispatched This Month" noPadding>
              {dispatchedMonth.length === 0 ? (
                <div className="p-6"><EmptyState icon={Package} title="No confirmed dispatches this month" /></div>
              ) : (
                <table className="erp-table">
                  <thead><tr><th>Dispatch</th><th>SO</th><th>Confirmed</th></tr></thead>
                  <tbody>
                    {dispatchedMonth.map((d) => (
                      <tr key={d.id}>
                        <td><TableLink to={`/dispatch/${d.id}`}>{d.dispatchNo}</TableLink></td>
                        <td>{d.salesOrderNo ?? '—'}</td>
                        <td>{d.confirmedAt ? formatDate(d.confirmedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SectionCard>

            <SectionCard title="POD Pending">
              <p className="text-[12px] text-erp-muted">
                Proof-of-delivery tracking is not available yet — the delivery lifecycle currently ends at
                challan issue and dispatch confirmation. Track issued challans from the{' '}
                <Link to="/dispatch/delivery-challans" className="font-semibold text-erp-primary hover:underline">
                  Delivery Challan register
                </Link>.
              </p>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}
