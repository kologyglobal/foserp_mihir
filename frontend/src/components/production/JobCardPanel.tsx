import { useEffect, useState } from 'react'
import { ClipboardList, Clock, Users } from 'lucide-react'
import type { JobCard, WorkOrderProductionOperation } from '../../types/workorder'
import type { JobCardQcCheck } from '../../types/qc'
import { allQcChecksPassed, toJobCardQcChecks } from '../../types/qc'
import { Badge, formatStatus, statusColor } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SHOP_FLOOR_TEAMS } from '../../utils/jobCard'
import { QcChecklistPanel } from './QcChecklistPanel'
import { OperationQualityStrip } from './OperationQualityStrip'
import type { QcInspection, ReworkOrder } from '../../types/quality'

interface JobCardPanelProps {
  woNo: string
  workOrderId: string
  operation: WorkOrderProductionOperation
  jobCard: JobCard | undefined
  inspections: QcInspection[]
  reworks: ReworkOrder[]
  sequenceBlocked?: boolean
  sequenceBlockReason?: string
  onStart: (jobCardId: string, assignedTeam: string, startTime: string) => void
  onComplete: (
    jobCardId: string,
    endTime: string,
    actualHours: number,
    remarks: string,
    qcChecks: JobCardQcCheck[],
  ) => void
}

export function JobCardPanel({
  woNo,
  workOrderId,
  operation,
  jobCard,
  inspections,
  reworks,
  sequenceBlocked,
  sequenceBlockReason,
  onStart,
  onComplete,
}: JobCardPanelProps) {
  const [assignedTeam, setAssignedTeam] = useState(jobCard?.assignedTeam ?? '')
  const [startTime, setStartTime] = useState(jobCard?.startTime ?? '08:00')
  const [endTime, setEndTime] = useState(jobCard?.endTime ?? '17:00')
  const [actualHours, setActualHours] = useState(jobCard?.actualHours?.toString() ?? '')
  const [remarks, setRemarks] = useState(jobCard?.remarks ?? '')
  const [qcChecks, setQcChecks] = useState<JobCardQcCheck[]>([])

  useEffect(() => {
    if (!jobCard) {
      setQcChecks([])
      return
    }
    if (jobCard.qcChecks.length > 0) {
      setQcChecks(jobCard.qcChecks)
    } else if (jobCard.requiresQc && (operation.qcChecklist?.length ?? 0) > 0) {
      setQcChecks(toJobCardQcChecks(operation.qcChecklist))
    } else {
      setQcChecks([])
    }
  }, [jobCard, operation.qcChecklist])

  const isCompleted = jobCard?.status === 'completed'
  const isInProgress = jobCard?.status === 'in_progress' || jobCard?.status === 'assigned'
  const hasQcChecklist = (jobCard?.qcChecks?.length ?? 0) > 0 || ((operation.qcChecklist?.length ?? 0) > 0 && operation.qcRequired)
  const qcReady = !hasQcChecklist || allQcChecksPassed(qcChecks)

  return (
    <div className="rounded-md border border-erp-border bg-erp-surface shadow-erp">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border bg-erp-surface-alt px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[13px] font-semibold text-erp-primary">{woNo}</span>
          <span className="text-erp-muted">·</span>
          <span className="text-[13px] font-medium text-erp-text">
            Operation {operation.sequenceNo}
          </span>
          <span className="text-[13px] text-erp-muted">{operation.operationName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={statusColor(operation.status)}>{formatStatus(operation.status)}</Badge>
          {operation.qcRequired && <Badge color="yellow">QC Required</Badge>}
          {operation.outsourced && <Badge color="purple">Outsourced</Badge>}
        </div>
      </div>

      {!jobCard ? (
        <p className="px-4 py-6 text-[13px] text-erp-muted">
          Job card will be generated when production starts.
        </p>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[240px_1fr]">
          <div className="rounded-md border border-erp-primary/20 bg-erp-primary-soft px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-erp-primary">
              <ClipboardList className="h-3.5 w-3.5" />
              Job Card
            </div>
            <p className="font-mono text-xl font-bold text-erp-text">{jobCard.jobCardNo}</p>
            <p className="mt-1 font-mono text-[11px] text-erp-muted">{jobCard.workCenterCode}</p>
            <div className="mt-3">
              <Badge color={statusColor(jobCard.status)}>{formatStatus(jobCard.status)}</Badge>
            </div>
            <p className="mt-3 text-[12px] text-erp-muted">
              Planned: <span className="font-semibold text-erp-text">{jobCard.plannedHours.toFixed(1)} hrs</span>
            </p>
          </div>

          <div className="space-y-3">
            <OperationQualityStrip
              workOrderId={workOrderId}
              operation={operation}
              inspections={inspections}
              reworks={reworks}
            />

            {sequenceBlocked && !isCompleted && (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                {sequenceBlockReason ?? 'Previous routing step must be QC-released before this operation can start.'}
              </p>
            )}

            {isCompleted ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <JobField icon={Users} label="Assigned" value={jobCard.assignedTeam ?? '—'} />
                  <JobField icon={Clock} label="Start" value={jobCard.startTime ?? '—'} />
                  <JobField icon={Clock} label="End" value={jobCard.endTime ?? '—'} />
                  <JobField icon={Clock} label="Hours" value={jobCard.actualHours?.toFixed(1) ?? '—'} />
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Remarks</dt>
                    <dd className="mt-1 text-[13px] text-erp-text">{jobCard.remarks || '—'}</dd>
                  </div>
                </dl>
                {jobCard.qcChecks?.length > 0 && (
                  <QcChecklistPanel items={jobCard.qcChecks} readonly />
                )}
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Assigned</span>
                    <select
                      className="mt-1 h-8 w-full rounded-sm border border-erp-border px-2 text-[13px]"
                      value={assignedTeam}
                      onChange={(e) => setAssignedTeam(e.target.value)}
                      disabled={isInProgress}
                    >
                      <option value="">Select team…</option>
                      {SHOP_FLOOR_TEAMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Start</span>
                    <input
                      type="time"
                      className="mt-1 h-8 w-full rounded-sm border border-erp-border px-2 text-[13px]"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      disabled={isInProgress}
                    />
                  </label>
                  {isInProgress && (
                    <>
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">End</span>
                        <input
                          type="time"
                          className="mt-1 h-8 w-full rounded-sm border border-erp-border px-2 text-[13px]"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Hours</span>
                        <input
                          type="number"
                          step="0.1"
                          className="mt-1 h-8 w-full rounded-sm border border-erp-border px-2 text-[13px]"
                          placeholder="8.5"
                          value={actualHours}
                          onChange={(e) => setActualHours(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                </div>
                {isInProgress && hasQcChecklist && (
                  <QcChecklistPanel items={qcChecks} onChange={setQcChecks} />
                )}
                {isInProgress && (
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Remarks</span>
                    <textarea
                      className="mt-1 w-full rounded-sm border border-erp-border px-2 py-1.5 text-[13px]"
                      rows={2}
                      placeholder="Tank shell completed"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  {!isInProgress && (
                    <Button
                      size="sm"
                      onClick={() => onStart(jobCard.id, assignedTeam, startTime)}
                      disabled={!assignedTeam || !startTime || sequenceBlocked}
                    >
                      Start Job Card
                    </Button>
                  )}
                  {isInProgress && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() =>
                        onComplete(jobCard.id, endTime, parseFloat(actualHours) || 0, remarks, qcChecks)
                      }
                      disabled={!endTime || !(parseFloat(actualHours) > 0) || !qcReady}
                    >
                      Complete Job Card
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function JobField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 text-[13px] font-medium text-erp-text">{value}</dd>
    </div>
  )
}
