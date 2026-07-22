import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot } from '@/components/design-system/StatusDot'
import { listInspections, type QualityInspection } from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'

/** API-mode thin QC queue — pending in-process and final inspections. */
export function ApiQcQueuePage() {
  const [rows, setRows] = useState<QualityInspection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInspections({ status: 'PENDING', limit: 100 })
      setRows(res.data.filter((i) => i.category === 'IN_PROCESS' || i.category === 'FINAL'))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load QC queue')
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
      title="QC Queue"
      description="Pending manufacturing inspections awaiting decision (API mode)."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'QC Queue' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/queue"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No pending inspections" description="All caught up on in-process and final QC." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-4 py-2">Inspection</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Work Order</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Requested</th>
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
                      <Link to={`/manufacturing/work-orders/${row.productionOrderId}`} className="text-erp-primary hover:underline">
                        View WO
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">{row.title}</td>
                  <td className="px-4 py-2">{formatDateTime(row.requestedAt)}</td>
                  <td className="px-4 py-2">
                    <StatusDot label={row.status.toLowerCase()} tone="warning" />
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
