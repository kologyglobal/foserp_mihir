import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { DetailField, DetailGrid, DetailLayout, DetailSection } from '@/components/masters/MasterLayouts'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Select } from '@/components/forms/Inputs'
import {
  closeNcr,
  getNcr,
  listNcrs,
  type QualityNcr,
  type QualityNcrStatus,
} from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'

const OPEN_STATUSES: QualityNcrStatus[] = ['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED']

const STATUS_FILTER_OPTIONS: Array<{ value: '' | QualityNcrStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'CORRECTIVE_ACTION', label: 'Corrective action' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function severityTone(severity: string): 'neutral' | 'warning' | 'danger' | 'success' | 'info' {
  const s = severity.toLowerCase()
  if (s === 'critical') return 'danger'
  if (s === 'major') return 'warning'
  if (s === 'minor') return 'info'
  return 'neutral'
}

function statusTone(status: string): 'neutral' | 'warning' | 'danger' | 'success' | 'info' {
  const s = status.toLowerCase()
  if (s === 'closed' || s === 'approved') return 'success'
  if (s === 'cancelled') return 'neutral'
  if (s === 'open') return 'danger'
  return 'warning'
}

function canClose(status: string): boolean {
  return OPEN_STATUSES.includes(status as QualityNcrStatus)
}

/** Live NCR register — NCRs opened from REJECT decisions (Quality Phase 4A). */
export function ApiNcrRegisterPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityNcr[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'' | QualityNcrStatus>('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listNcrs({
        limit: 100,
        ...(statusFilter ? { status: statusFilter } : {}),
      })
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load NCRs')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (n) =>
        n.ncrNumber.toLowerCase().includes(q) ||
        n.title.toLowerCase().includes(q) ||
        (n.description ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Quality"
      title="NCR Register"
      description="Non-conformance reports opened from rejected inspections. Close when containment and corrective action are complete."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'NCR' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/ncr"
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
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-erp-muted">Status</span>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | QualityNcrStatus)}
            className="min-w-[12rem]"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-erp-muted">Search</span>
          <input
            type="search"
            className="erp-input min-w-[16rem]"
            placeholder="NCR number or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No NCRs"
          description={
            statusFilter || search
              ? 'No NCRs match the current filters.'
              : 'NCRs are created automatically when an inspection is rejected.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-4 py-2">NCR</th>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Work Order</th>
                <th className="px-4 py-2">Inspection</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/60 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link to={`/quality/ncr/${row.id}`} className="text-erp-primary hover:underline">
                      {row.ncrNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.title}</td>
                  <td className="px-4 py-2">
                    <StatusDot label={row.severity.toLowerCase()} tone={severityTone(row.severity)} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusDot label={row.status.toLowerCase().replace(/_/g, ' ')} tone={statusTone(row.status)} />
                  </td>
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
                  <td className="px-4 py-2">
                    {row.inspectionId ? (
                      <Link
                        to={`/quality/inspections/${row.inspectionId}`}
                        className="font-mono text-xs text-erp-primary hover:underline"
                      >
                        Open
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}

/** Live NCR detail — view + close (Phase 4A). */
export function ApiNcrDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [ncr, setNcr] = useState<QualityNcr | null>(null)
  const [closureNotes, setClosureNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getNcr(id)
      setNcr(res.data)
      setClosureNotes(res.data.closureNotes ?? '')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load NCR')
      setNcr(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleClose() {
    if (!ncr || !canClose(ncr.status)) return
    setBusy(true)
    try {
      const res = await closeNcr(ncr.id, { closureNotes: closureNotes.trim() || undefined })
      setNcr(res.data)
      notify.success(`NCR ${res.data.ncrNumber} closed`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to close NCR')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState variant="card" />
  if (!ncr) {
    return (
      <div className="p-8 text-center text-slate-500">
        NCR not found.{' '}
        <Link to="/quality/ncr" className="text-erp-accent hover:underline">
          Back to register
        </Link>
      </div>
    )
  }

  return (
    <DetailLayout
      backTo="/quality/ncr"
      backLabel="NCR Register"
      title={ncr.ncrNumber}
      subtitle={ncr.title}
      badges={<StatusBadge status={ncr.status} />}
    >
      <DetailSection title="Links">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate('/quality/queue')}>
            QC Queue
          </Button>
          {ncr.inspectionId && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/quality/inspections/${ncr.inspectionId}`)}
            >
              Source inspection
            </Button>
          )}
          {ncr.productionOrderId && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/manufacturing/work-orders/${ncr.productionOrderId}`)}
            >
              Work order
            </Button>
          )}
        </div>
      </DetailSection>

      <DetailSection title="Non-conformance">
        <DetailGrid>
          <DetailField label="Severity" value={ncr.severity} />
          <DetailField label="Status" value={ncr.status.replace(/_/g, ' ')} />
          <DetailField label="Description" value={ncr.description ?? '—'} />
          <DetailField label="Disposition" value={ncr.disposition ?? '—'} />
          <DetailField label="Created" value={formatDateTime(ncr.createdAt)} />
          <DetailField label="Closed" value={ncr.closedAt ? formatDateTime(ncr.closedAt) : '—'} />
        </DetailGrid>
      </DetailSection>

      {canClose(ncr.status) ? (
        <DetailSection title="Closure">
          <div className="max-w-xl space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Closure notes</span>
              <textarea
                className="erp-input mt-1 w-full"
                rows={3}
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                disabled={busy}
              />
            </label>
            <Button type="button" size="sm" disabled={busy} onClick={() => void handleClose()}>
              Close NCR
            </Button>
          </div>
        </DetailSection>
      ) : (
        ncr.closureNotes && (
          <DetailSection title="Closure">
            <DetailField label="Notes" value={ncr.closureNotes} />
          </DetailSection>
        )
      )}
    </DetailLayout>
  )
}
