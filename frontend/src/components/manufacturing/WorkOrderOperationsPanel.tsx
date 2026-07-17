import { useState } from 'react'
import type { WorkOrderOperation } from '@/types/manufacturingRoute'
import { WO_OPERATION_STATUS_LABELS } from '@/types/manufacturingRoute'
import { cn } from '@/utils/cn'
import { formatDateTime } from '@/utils/dates/format'
import { MfgTouchBtn } from './ManufacturingMobile'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'

export function WorkOrderOperationsTracker({ operations }: { operations: WorkOrderOperation[] }) {
  const sorted = [...operations].sort((a, b) => a.sequenceNo - b.sequenceNo)
  if (!sorted.length) return null
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-erp-border bg-slate-50 px-3 py-3">
      {sorted.map((op, i) => {
        const active = ['in_progress', 'on_hold', 'qc_pending', 'ready', 'rework'].includes(op.status)
        const done = ['accepted', 'completed', 'skipped'].includes(op.status)
        return (
          <li key={op.id} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-erp-muted" aria-hidden>→</span> : null}
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1',
                done && 'bg-emerald-50 text-emerald-900 ring-emerald-200',
                active && !done && 'bg-erp-primary text-white ring-erp-primary',
                !active && !done && 'bg-white text-erp-muted ring-erp-border',
              )}
            >
              {op.operationName}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function WorkOrderOperationsPanel({
  operations,
  readOnly,
  busy,
  onStart,
  onHold,
  onResume,
  onComplete,
  onSendQc,
  onQc,
  onJobWork,
}: {
  operations: WorkOrderOperation[]
  readOnly?: boolean
  busy?: boolean
  onStart: (opId: string, operator: string) => void
  onHold: (opId: string) => void
  onResume: (opId: string) => void
  onComplete: (opId: string, qty: number, scrap: number, rework: number, rejected: number) => void
  onSendQc: (opId: string) => void
  onQc: (opId: string, result: 'accepted' | 'rejected' | 'rework') => void
  onJobWork: (opId: string, action: 'send' | 'receive') => void
}) {
  const [completeFor, setCompleteFor] = useState<string | null>(null)
  const [qty, setQty] = useState(0)
  const [scrap, setScrap] = useState(0)
  const [rework, setRework] = useState(0)
  const [rejected, setRejected] = useState(0)
  const [operator, setOperator] = useState('Shopfloor')

  const sorted = [...operations].sort((a, b) => a.sequenceNo - b.sequenceNo)

  if (!sorted.length) {
    return (
      <p className="rounded-xl border border-dashed border-erp-border bg-white px-4 py-8 text-center text-[13px] text-erp-muted">
        No operation stages. Attach an active Route for this finished item, or create the WO after activating a Route.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <WorkOrderOperationsTracker operations={sorted} />
      <ul className="space-y-3">
        {sorted.map((op) => (
          <li key={op.id} className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold text-erp-text">
                  <span className="text-erp-muted">{op.sequenceNo}.</span> {op.operationName}
                </p>
                <p className="text-[12px] text-erp-muted">{op.workCenter}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-erp-text ring-1 ring-erp-border">
                {WO_OPERATION_STATUS_LABELS[op.status]}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
              <div><dt className="text-erp-muted">Planned</dt><dd className="font-semibold tabular-nums">{op.plannedQty}</dd></div>
              <div><dt className="text-erp-muted">Completed</dt><dd className="font-semibold tabular-nums">{op.completedQty}</dd></div>
              <div><dt className="text-erp-muted">Pending</dt><dd className="font-semibold tabular-nums">{op.pendingQty}</dd></div>
              <div><dt className="text-erp-muted">Scrap / Rework / Reject</dt><dd className="font-semibold tabular-nums">{op.scrapQty} / {op.reworkQty} / {op.rejectedQty}</dd></div>
              <div><dt className="text-erp-muted">Operator</dt><dd className="font-medium">{op.operator || '—'}</dd></div>
              <div><dt className="text-erp-muted">Start</dt><dd>{op.startedAt ? formatDateTime(op.startedAt) : '—'}</dd></div>
              <div><dt className="text-erp-muted">End</dt><dd>{op.endedAt ? formatDateTime(op.endedAt) : '—'}</dd></div>
              <div className="flex flex-wrap gap-1">
                {op.qcRequired ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-200">QC</span> : null}
                {op.jobWorkRequired ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200">Job Work</span> : null}
              </div>
            </dl>

            {!readOnly ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {['ready', 'pending'].includes(op.status) ? (
                  <MfgTouchBtn
                    variant="primary"
                    disabled={busy}
                    className="flex-none"
                    onClick={() => onStart(op.id, operator)}
                  >
                    Start Operation
                  </MfgTouchBtn>
                ) : null}
                {op.status === 'in_progress' ? (
                  <>
                    <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onHold(op.id)}>Hold</MfgTouchBtn>
                    <MfgTouchBtn
                      variant="primary"
                      disabled={busy}
                      className="flex-none"
                      onClick={() => {
                        setCompleteFor(op.id)
                        setQty(op.pendingQty || op.plannedQty)
                        setScrap(0)
                        setRework(0)
                        setRejected(0)
                      }}
                    >
                      Complete Operation
                    </MfgTouchBtn>
                    {op.qcRequired ? (
                      <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onSendQc(op.id)}>Send to QC</MfgTouchBtn>
                    ) : null}
                  </>
                ) : null}
                {op.status === 'on_hold' ? (
                  <MfgTouchBtn variant="primary" disabled={busy} className="flex-none" onClick={() => onResume(op.id)}>Resume Operation</MfgTouchBtn>
                ) : null}
                {op.status === 'qc_pending' ? (
                  <>
                    <MfgTouchBtn variant="primary" disabled={busy} className="flex-none" onClick={() => onQc(op.id, 'accepted')}>Accept</MfgTouchBtn>
                    <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onQc(op.id, 'rejected')}>Reject</MfgTouchBtn>
                    <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onQc(op.id, 'rework')}>Rework</MfgTouchBtn>
                  </>
                ) : null}
                {op.status === 'rework' ? (
                  <MfgTouchBtn variant="primary" disabled={busy} className="flex-none" onClick={() => onStart(op.id, operator)}>Restart after rework</MfgTouchBtn>
                ) : null}
                {op.jobWorkRequired && ['ready', 'in_progress'].includes(op.status) ? (
                  <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onJobWork(op.id, 'send')}>Send to Job Work</MfgTouchBtn>
                ) : null}
                {op.jobWorkRequired && op.status === 'in_progress' ? (
                  <MfgTouchBtn variant="secondary" disabled={busy} className="flex-none" onClick={() => onJobWork(op.id, 'receive')}>Receive from Job Work</MfgTouchBtn>
                ) : null}
              </div>
            ) : null}

            {completeFor === op.id ? (
              <div className="mt-3 grid gap-2 rounded-lg border border-erp-border bg-slate-50 p-3 sm:grid-cols-2">
                <FormField label="Completed Qty" required>
                  <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                </FormField>
                <FormField label="Operator">
                  <Input value={operator} onChange={(e) => setOperator(e.target.value)} />
                </FormField>
                {op.allowScrap ? (
                  <FormField label="Scrap Qty">
                    <Input type="number" value={scrap} onChange={(e) => setScrap(Number(e.target.value))} />
                  </FormField>
                ) : null}
                {op.allowRework ? (
                  <FormField label="Rework Qty">
                    <Input type="number" value={rework} onChange={(e) => setRework(Number(e.target.value))} />
                  </FormField>
                ) : null}
                {op.allowReject ? (
                  <FormField label="Rejected Qty">
                    <Input type="number" value={rejected} onChange={(e) => setRejected(Number(e.target.value))} />
                  </FormField>
                ) : null}
                <div className="flex gap-2 sm:col-span-2">
                  <MfgTouchBtn
                    variant="primary"
                    disabled={busy || qty <= 0}
                    onClick={() => {
                      onComplete(op.id, qty, scrap, rework, rejected)
                      setCompleteFor(null)
                    }}
                  >
                    Confirm Complete
                  </MfgTouchBtn>
                  <MfgTouchBtn variant="secondary" onClick={() => setCompleteFor(null)}>Cancel</MfgTouchBtn>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
