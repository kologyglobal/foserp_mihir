import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, ClipboardCheck, Pause, Play, ShieldCheck } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/forms/Inputs'
import { QcChecklistPanel } from '../../components/production/QcChecklistPanel'
import { useShopFloorQueue } from '../../utils/controlTowerMetrics'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { SHOP_FLOOR_TEAMS } from '../../utils/jobCard'
import { allQcChecksPassed, toJobCardQcChecks } from '../../types/qc'
import type { JobCardQcCheck } from '../../types/qc'
import { cn } from '../../utils/cn'

export function ShopFloorJobQueuePage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [team, setTeam] = useState(SHOP_FLOOR_TEAMS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [qcChecks, setQcChecks] = useState<JobCardQcCheck[]>([])

  const { queue, inProgress, pending, qcHold } = useShopFloorQueue(team)
  const startJobCard = useWorkOrderStore((s) => s.startJobCard)
  const pauseJobCard = useWorkOrderStore((s) => s.pauseJobCard)
  const completeJobCard = useWorkOrderStore((s) => s.completeJobCard)
  const productionOperations = useWorkOrderStore((s) => s.productionOperations)
  const getOperation = useCallback(
    (opId: string) => productionOperations.find((o) => o.id === opId),
    [productionOperations],
  )

  const selected = useMemo(() => queue.find((j) => j.id === selectedId) ?? queue[0], [queue, selectedId])
  const selectedOp = selected ? getOperation(selected.productionOperationId) : undefined

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handleSelect(jobId: string) {
    setSelectedId(jobId)
    const jc = queue.find((j) => j.id === jobId)
    const op = jc ? getOperation(jc.productionOperationId) : undefined
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
      remarks: 'Completed from shop floor queue',
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
        title="Shop Floor Job Queue"
        description="Tablet-friendly job queue — my jobs, start, pause, complete, and QC."
        autoBreadcrumbs
        favoritePath={pathname}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium text-erp-muted">My Team</label>
        <Select value={team} onChange={(e) => setTeam(e.target.value)} className="h-11 min-w-[220px] text-[15px]">
          {SHOP_FLOOR_TEAMS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Badge color="blue">{inProgress} in progress</Badge>
          <Badge color="yellow">{pending} pending</Badge>
          <Badge color="orange">{qcHold} QC hold</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">My Jobs</p>
          {queue.map((jc) => (
            <button
              key={jc.id}
              type="button"
              onClick={() => handleSelect(jc.id)}
              className={cn(
                'w-full rounded-xl border p-4 text-left transition-all',
                selected?.id === jc.id
                  ? 'border-erp-primary bg-erp-primary-soft shadow-erp'
                  : 'border-erp-border bg-erp-surface hover:border-erp-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-lg font-bold text-erp-primary">{jc.jobCardNo}</p>
                  <p className="text-[14px] font-medium">{jc.operationName}</p>
                  <p className="text-[12px] text-erp-muted">{jc.woNo} · {jc.workCenterCode}</p>
                </div>
                <Badge color={statusColor(jc.status)}>{formatStatus(jc.status)}</Badge>
              </div>
            </button>
          ))}
          {queue.length === 0 && (
            <p className="rounded-xl border border-dashed border-erp-border py-12 text-center text-erp-muted">
              No jobs in queue for {team}
            </p>
          )}
        </div>

        {selected && (
          <div className="rounded-xl border border-erp-border bg-erp-surface p-5 shadow-erp lg:col-span-3">
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-wide text-erp-muted">Active Job</p>
              <h2 className="mt-1 font-mono text-2xl font-bold text-erp-text">{selected.jobCardNo}</h2>
              <p className="text-[15px] text-erp-muted">
                {selected.woNo} · Op {selected.sequenceNo} · {selected.operationName}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/work-orders/${selected.workOrderId}`)}
                className="mt-2 text-[13px] font-medium text-erp-primary hover:underline"
              >
                Open work order detail
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Button
                size="lg"
                className="h-16 flex-col gap-1 text-[13px]"
                onClick={handleStart}
                disabled={selected.status === 'in_progress' || selected.status === 'completed'}
              >
                <Play className="h-6 w-6" />
                Start
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-16 flex-col gap-1 text-[13px]"
                onClick={handlePause}
                disabled={selected.status !== 'in_progress'}
              >
                <Pause className="h-6 w-6" />
                Pause
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-16 flex-col gap-1 text-[13px]"
                onClick={handleComplete}
                disabled={selected.status === 'completed'}
              >
                <CheckCircle className="h-6 w-6" />
                Complete
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-16 flex-col gap-1 text-[13px]"
                onClick={() => navigate('/quality/queue')}
              >
                <ShieldCheck className="h-6 w-6" />
                QC
              </Button>
            </div>

            {selected.requiresQc && selectedOp && (selectedOp.qcChecklist?.length ?? 0) > 0 && (
              <div className="mt-6 rounded-lg border border-erp-border p-4">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
                  <ClipboardCheck className="h-4 w-4 text-erp-primary" />
                  QC Checklist
                </div>
                <QcChecklistPanel items={qcChecks} onChange={setQcChecks} readonly={selected.status === 'completed'} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
