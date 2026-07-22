import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot } from '@/components/design-system/StatusDot'
import { listInspections, type QualityInspection } from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'

/**
 * Live Rework Workbench — inspections decided as REWORK that still need
 * re-inspection / final disposition (API mode).
 *
 * There is no separate rework-WO document in Quality Phase 4A; rework is the
 * inspection status after a REWORK decision. Operators open the inspection to
 * re-decide PASS / REJECT / REWORK again.
 */
export function ApiReworkWorkbenchPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityInspection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInspections({ status: 'REWORK', limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load rework queue')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Quality"
      title="Rework Workbench"
      description="Inspections sent for rework — open to re-inspect and decide PASS, REJECT, or REWORK again."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Rework' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/rework"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'queue', label: 'QC Queue', onClick: () => navigate('/quality/queue') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No open rework"
          description="Inspections decided as REWORK will appear here until they are re-decided."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-4 py-2">Inspection</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Work Order</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Rework qty</th>
                <th className="px-4 py-2">Decided</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link to={`/quality/inspections/${row.id}`} className="text-erp-primary hover:underline">
                      {row.inspectionNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2">
                    {row.productionOrderId ? (
                      <Link
                        to={`/manufacturing/work-orders/${row.productionOrderId}`}
                        className="text-erp-primary hover:underline"
                      >
                        View WO
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">{row.title}</td>
                  <td className="px-4 py-2 tabular-nums">{row.reworkQty ?? '—'}</td>
                  <td className="px-4 py-2">{row.decidedAt ? formatDateTime(row.decidedAt) : '—'}</td>
                  <td className="px-4 py-2">
                    <StatusDot label="rework" tone="warning" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}
