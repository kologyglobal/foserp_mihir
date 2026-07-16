import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, Pause, Play, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/forms/Inputs'
import { QcChecklistPanel } from '../../components/production/QcChecklistPanel'
import { useJobCardWorkbench, type JobCardWorkbenchView } from '../../utils/workOrder360Metrics'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { SHOP_FLOOR_TEAMS } from '../../utils/jobCard'
import { allQcChecksPassed, toJobCardQcChecks } from '../../types/qc'
import type { JobCardQcCheck } from '../../types/qc'
import { cn } from '../../utils/cn'
import { formatDate } from '../../utils/dates/format'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'

const VIEWS: { id: JobCardWorkbenchView; label: string }[] = [
  { id: 'my_jobs', label: 'My Jobs' },
  { id: 'all_open', label: 'All Open Jobs' },
  { id: 'waiting_material', label: 'Waiting Material' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'qc_pending', label: 'QC Pending' },
  { id: 'rework', label: 'Rework' },
  { id: 'completed', label: 'Completed' },
]

export function JobCardWorkbenchPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [view, setView] = useState<JobCardWorkbenchView>('my_jobs')
  const [team, setTeam] = useState(SHOP_FLOOR_TEAMS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [qcChecks, setQcChecks] = useState<JobCardQcCheck[]>([])

  const { rows, getOperation, getWo } = useJobCardWorkbench(view, team)
  const startJobCard = useWorkOrderStore((s) => s.startJobCard)
  const pauseJobCard = useWorkOrderStore((s) => s.pauseJobCard)
  const completeJobCard = useWorkOrderStore((s) => s.completeJobCard)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const getOp = useCallback(
    (opId: string) => productionOperations.find((o) => o.id === opId),
    [productionOperations],
  )

  const selected = useMemo(() => rows.find((j) => j.id === selectedId) ?? rows[0], [rows, selectedId])
  const selectedOp = selected ? getOp(selected.productionOperationId) : undefined

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handleSelect(jobId: string) {
    setSelectedId(jobId)
    const jc = rows.find((j) => j.id === jobId)
    const op = jc ? getOp(jc.productionOperationId) : undefined
    if (jc && op && jc.requiresQc && op.qcChecklist?.length) {
      setQcChecks(jc.qcChecks.length ? jc.qcChecks : toJobCardQcChecks(op.qcChecklist))
    } else {
      setQcChecks([])
    }
  }

  function handleStart() {
    if (!selected) return
    const now = new Date()
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const r = startJobCard(selected.id, { assignedTeam: team, startTime })
    show(r.ok ? `Started ${selected.jobCardNo}` : r.error ?? 'Start failed')
  }

  function handlePause() {
    if (!selected) return
    const r = pauseJobCard(selected.id)
    show(r.ok ? `Paused ${selected.jobCardNo}` : r.error ?? 'Pause failed')
  }

  function handleComplete() {
    if (!selected) return
    const hasQc = selected.requiresQc && qcChecks.length > 0
    if (hasQc && !allQcChecksPassed(qcChecks)) {
      show('Complete QC checklist before finishing')
      return
    }
    const now = new Date()
    const endTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const r = completeJobCard(selected.id, {
      endTime,
      actualHours: selected.plannedHours || 1,
      remarks: remarks || 'Completed from job card workbench',
      qcChecks: hasQc ? qcChecks : undefined,
    })
    show(r.ok ? `Completed ${selected.jobCardNo}` : r.error ?? 'Complete failed')
  }

  return (
    <div className="erp-page max-w-6xl">
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-erp-border bg-erp-surface px-6 py-3 text-[15px] font-medium shadow-erp-lg">
          {toast}
        </div>
      )}

      <PageHeader
        title="Job Card Workbench"
        description="Supervisor and operator workspace — start, pause, complete, and QC job cards."
        autoBreadcrumbs
        favoritePath={pathname}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
              view === v.id ? 'border-erp-primary bg-erp-primary/10 text-erp-primary' : 'border-erp-border bg-erp-surface',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium text-erp-muted">Team</label>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="h-11 min-w-[220px]">
          {SHOP_FLOOR_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Button variant="secondary" size="sm" onClick={() => navigate('/shop-floor')}>Shop Floor Queue</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-erp-border bg-erp-surface p-6 text-sm text-erp-muted">No job cards in this view.</p>
          ) : (
            rows.map((jc) => {
              const wo = getWo(jc.workOrderId)
              const op = getOperation(jc.productionOperationId)
              return (
                <button
                  key={jc.id}
                  type="button"
                  onClick={() => handleSelect(jc.id)}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition',
                    selected?.id === jc.id ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border bg-erp-surface hover:border-erp-primary/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{jc.jobCardNo}</p>
                      <p className="text-xs text-erp-muted">{wo?.woNo} · {op?.operationName}</p>
                    </div>
                    <Badge color={statusColor(jc.status)}>{formatStatus(jc.status)}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-erp-muted">
                    <span>WC: {jc.workCenterCode}</span>
                    <span>Team: {jc.assignedTeam ?? '—'}</span>
                    <span>Planned: {jc.plannedHours}h</span>
                    <span>Actual: {jc.actualHours ?? '—'}h</span>
                    {jc.requiresQc && <span className="text-erp-warning">QC required</span>}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="lg:col-span-3 rounded-xl border border-erp-border bg-erp-surface p-4">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold">{selected.jobCardNo}</h3>
                <EntityQrToolbar
                  entityType="JOB_CARD"
                  entityId={selected.id}
                  displayCode={selected.jobCardNo}
                  metadata={{ jobCardId: selected.id, jobCardNo: selected.jobCardNo, woId: selected.workOrderId, woNo: selected.woNo }}
                  payload={{ wo: selected.woNo }}
                />
              </div>
              <p className="text-sm text-erp-muted">{getWo(selected.workOrderId)?.woNo} · {selectedOp?.operationName}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['pending', 'assigned'].includes(selected.status) && (
                  <Button size="sm" onClick={handleStart}><Play className="h-4 w-4" /> Start</Button>
                )}
                {selected.status === 'in_progress' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={handlePause}><Pause className="h-4 w-4" /> Pause</Button>
                    <Button size="sm" onClick={handleComplete}><CheckCircle className="h-4 w-4" /> Complete</Button>
                  </>
                )}
                {selected.status === 'in_progress' && selected.requiresQc && (
                  <Button size="sm" variant="secondary" onClick={() => navigate('/quality/queue')}><ShieldCheck className="h-4 w-4" /> Send to QC</Button>
                )}
              </div>
              <textarea
                className="mt-4 w-full rounded-lg border border-erp-border p-2 text-sm"
                placeholder="Add remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
              {selected.requiresQc && qcChecks.length > 0 && (
                <div className="mt-4">
                  <QcChecklistPanel items={qcChecks} onChange={setQcChecks} />
                </div>
              )}
              <p className="mt-4 text-xs text-erp-muted">Due: {formatDate(getWo(selected.workOrderId)?.plannedFinishDate ?? '')}</p>
            </>
          ) : (
            <p className="text-sm text-erp-muted">Select a job card to view actions.</p>
          )}
        </div>
      </div>
    </div>
  )
}
