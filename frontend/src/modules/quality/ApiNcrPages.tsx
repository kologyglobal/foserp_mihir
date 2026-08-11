import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { StatusDot } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { DetailField, DetailGrid, DetailLayout, DetailSection } from '@/components/masters/MasterLayouts'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { ErpStickySaveBar } from '@/components/erp/card-form'
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

  const columns = useMemo<ColumnDef<QualityNcr, unknown>[]>(
    () => [
      {
        id: 'ncrNumber',
        accessorKey: 'ncrNumber',
        header: 'NCR',
        enableHiding: false,
        cell: ({ row }) => <TableLink to={`/quality/ncr/${row.original.id}`}>{row.original.ncrNumber}</TableLink>,
      },
      { id: 'title', accessorKey: 'title', header: 'Title' },
      {
        id: 'severity',
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ row }) => <StatusDot label={row.original.severity.toLowerCase()} tone={severityTone(row.original.severity)} />,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => (
          <StatusDot label={row.original.status.toLowerCase().replace(/_/g, ' ')} tone={statusTone(row.original.status)} />
        ),
      },
      {
        id: 'workOrder',
        header: 'Work Order',
        accessorFn: (r) => r.productionOrderId ?? '',
        cell: ({ row }) =>
          row.original.productionOrderId ? (
            <Link to={`/manufacturing/work-orders/${row.original.productionOrderId}`} className="text-erp-primary hover:underline">
              View WO
            </Link>
          ) : (
            '-'
          ),
      },
      {
        id: 'inspection',
        header: 'Inspection',
        accessorFn: (r) => r.inspectionId ?? '',
        cell: ({ row }) =>
          row.original.inspectionId ? (
            <Link
              to={`/quality/inspections/${row.original.inspectionId}`}
              className="font-mono text-xs text-erp-primary hover:underline"
            >
              Open
            </Link>
          ) : (
            '-'
          ),
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
    ],
    [],
  )

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

      <EnterpriseRegisterTableShell className="min-w-0 flex-1">
        <DataGrid<QualityNcr>
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          columnLayoutKey="/quality/ncr"
          emptyMessage={
            statusFilter || search
              ? 'No NCRs match the current filters.'
              : 'No NCRs — they are created automatically when an inspection is rejected.'
          }
        />
      </EnterpriseRegisterTableShell>
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
          <DetailField label="Description" value={ncr.description ?? '-'} />
          <DetailField label="Disposition" value={ncr.disposition ?? '-'} />
          <DetailField label="Created" value={formatDateTime(ncr.createdAt)} />
          <DetailField label="Closed" value={ncr.closedAt ? formatDateTime(ncr.closedAt) : '-'} />
        </DetailGrid>
      </DetailSection>

      {canClose(ncr.status) ? (
        <>
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
            </div>
          </DetailSection>
          <ErpStickySaveBar
            onCancel={() => navigate('/quality/ncr')}
            submitLabel="Close NCR"
            isSubmitting={busy}
            onSave={() => void handleClose()}
            hint="Closure notes are saved when the NCR is closed."
          />
        </>
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
