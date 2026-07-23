import { useLayoutEffect, useMemo, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  completeStage,
  holdWorkOrder,
  recordProgress,
  startWorkOrder,
} from '@/services/api/manufacturingApi'
import {
  decideInspection,
  type QualityInspection,
  type QualityInspectionDecision,
} from '@/services/api/qualityApi'
import type {
  HoldReasonCategory,
  ProductionOrderStage,
} from '@/types/manufacturingProduction'
import {
  HOLD_REASON_CATEGORY_LABELS,
  HOLD_REASON_CATEGORY_VALUES,
} from '@/types/manufacturingProduction'
import { notify } from '@/store/toastStore'

type Step = 'qty' | 'qc' | 'hold'
/** send = force QC popup; continue = open next stage; override = skip required QC */
type QcPath = 'send' | 'continue' | 'override'

const QC_DECISIONS: Array<{ value: QualityInspectionDecision; label: string }> = [
  { value: 'PASS', label: 'Passed — continue next stage' },
  { value: 'CONDITIONAL_PASS', label: 'Conditionally accepted' },
  { value: 'REWORK', label: 'Rework' },
  { value: 'REJECT', label: 'Failed / Rejected' },
  { value: 'HOLD', label: 'QC Hold' },
]

function parseNonNeg(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function clampQty(raw: string, max: number | null): string {
  if (raw.trim() === '') return ''
  const n = Number(raw)
  if (!Number.isFinite(n)) return '0'
  if (n < 0) return '0'
  if (max != null && n > max) return String(max)
  return raw
}

export interface CompleteStageModalProps {
  open: boolean
  onClose: () => void
  workOrderId: string
  stage: ProductionOrderStage | null
  inspection?: QualityInspection | null
  onDone: () => void
}

/**
 * Complete Stage popup: capture qty (partial allowed), optional Hold,
 * and QC decide/override before promoting the next stage.
 */
export function CompleteStageModal({
  open,
  onClose,
  workOrderId,
  stage,
  inspection: inspectionProp,
  onDone,
}: CompleteStageModalProps) {
  const [step, setStep] = useState<Step>('qty')
  const [busy, setBusy] = useState(false)

  const [good, setGood] = useState('0')
  const [rework, setRework] = useState('0')
  const [rejected, setRejected] = useState('0')
  const [scrap, setScrap] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [qcPath, setQcPath] = useState<QcPath>('send')
  const [overrideReason, setOverrideReason] = useState('')

  const [holdReason, setHoldReason] = useState<HoldReasonCategory>('OTHER')
  const [holdExpectedResume, setHoldExpectedResume] = useState('')
  const [holdRemarks, setHoldRemarks] = useState('')

  const [activeInspection, setActiveInspection] = useState<QualityInspection | null>(null)
  const [qcDecision, setQcDecision] = useState<QualityInspectionDecision | ''>('')
  const [qcAccepted, setQcAccepted] = useState('')
  const [qcRejected, setQcRejected] = useState('')
  const [qcRemarks, setQcRemarks] = useState('')

  // useLayoutEffect so Good qty is prefilled before first paint (avoids flashing 0 / submitting 0 by mistake).
  useLayoutEffect(() => {
    if (!open || !stage) return
    const startOnQc = stage.status === 'QC_PENDING'
    setStep(startOnQc ? 'qc' : 'qty')
    setBusy(false)
    const plannedN = Number(stage.plannedQuantity)
    const goodN = Number(stage.goodQuantity)
    const remGood = Math.max(
      0,
      (Number.isFinite(plannedN) ? plannedN : 0) - (Number.isFinite(goodN) ? goodN : 0),
    )
    // Prefill remaining good so partial edits are easy; user can lower for partial complete.
    setGood(String(remGood))
    setRework('0')
    setRejected('0')
    setScrap('0')
    setRemarks('')
    // Flexible path: continue by default; Send to QC stays one click away. Already in QC → stay on send.
    setQcPath(startOnQc ? 'send' : 'continue')
    setOverrideReason('')
    setHoldReason('OTHER')
    setHoldExpectedResume('')
    setHoldRemarks('')
    setActiveInspection(inspectionProp ?? null)
    setQcDecision(startOnQc ? 'PASS' : '')
    setQcAccepted(inspectionProp?.inspectedQty ?? String((Number.isFinite(goodN) && goodN > 0 ? goodN : remGood) || ''))
    setQcRejected('0')
    setQcRemarks('')
  }, [
    open,
    stage?.id,
    stage?.status,
    stage?.plannedQuantity,
    stage?.goodQuantity,
    stage?.qualityRequired,
    inspectionProp?.id,
    inspectionProp?.inspectedQty,
  ])

  const planned = Number(stage?.plannedQuantity ?? 0)
  const goodSoFar = Number(stage?.goodQuantity ?? 0)
  const recordedTotalSoFar =
    goodSoFar +
    Number(stage?.reworkQuantity ?? 0) +
    Number(stage?.rejectedQuantity ?? 0) +
    Number(stage?.scrapQuantity ?? 0)

  const goodN = parseNonNeg(good)
  const reworkN = parseNonNeg(rework)
  const rejectedN = parseNonNeg(rejected)
  const scrapN = parseNonNeg(scrap)
  const entryTotal = goodN + reworkN + rejectedN + scrapN

  const remainingGood = Number.isFinite(planned) ? Math.max(0, planned - goodSoFar) : null
  const remainingTotal = Number.isFinite(planned) ? Math.max(0, planned - recordedTotalSoFar) : null

  const hasNegative =
    Number(good) < 0 || Number(rework) < 0 || Number(rejected) < 0 || Number(scrap) < 0
  const exceedsGood = remainingGood != null && goodN > remainingGood
  const exceedsTotal = remainingTotal != null && entryTotal > remainingTotal
  const qtyInvalid = hasNegative || exceedsGood || exceedsTotal

  const projectedGood = goodSoFar + goodN
  const isPartial = planned > 0 && projectedGood < planned
  const qualityRequired = Boolean(stage?.qualityRequired)

  const title = useMemo(() => {
    if (!stage) return 'Complete Stage'
    if (step === 'hold') return `Hold — ${stage.name}`
    if (step === 'qc') return `Stage QC — ${stage.name}`
    return `Complete Stage — ${stage.name}`
  }, [stage, step])

  const ensureProgressRecorded = async () => {
    if (!stage || entryTotal <= 0) return
    if (stage.status === 'NOT_STARTED' || stage.status === 'READY') {
      await startWorkOrder(workOrderId, { stageId: stage.id })
    }
    const res = await recordProgress(workOrderId, {
      stageId: stage.id,
      goodQuantity: goodN,
      reworkQuantity: reworkN,
      rejectedQuantity: rejectedN,
      scrapQuantity: scrapN,
      remarks: remarks.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    })
    res.data.warnings?.forEach((w) => notify.warning(w))
  }

  const finishClose = () => {
    onDone()
    onClose()
  }

  const runCompleteAndContinue = async () => {
    if (!stage || qtyInvalid) return
    if (qcPath === 'override' && !overrideReason.trim()) {
      notify.error('Enter an override reason to skip QC')
      return
    }
    setBusy(true)
    try {
      await ensureProgressRecorded()

      if (qcPath === 'send') {
        const res = await completeStage(workOrderId, {
          stageId: stage.id,
          remarks: remarks.trim() || undefined,
          skipQcGate: false,
          requireQc: true,
        })
        res.data.warnings?.forEach((w) => notify.warning(w))
        const inspection = (res.data.inspection as QualityInspection | undefined) ?? null
        if (res.data.awaitingQuality && inspection) {
          setActiveInspection(inspection)
          setQcDecision('PASS')
          setQcAccepted(inspection.inspectedQty ?? String(projectedGood || goodSoFar || ''))
          setQcRejected('0')
          setStep('qc')
          notify.info('Stage sent to QC — approve to open the next stage')
          return
        }
        if (res.data.awaitingQuality) {
          setActiveInspection(inspectionProp ?? null)
          setQcDecision('PASS')
          setStep('qc')
          notify.info('Stage awaiting QC — approve to open the next stage')
          return
        }
        notify.success(`Stage "${stage.name}" completed`)
        finishClose()
        return
      }

      const res = await completeStage(workOrderId, {
        stageId: stage.id,
        remarks: remarks.trim() || undefined,
        ...(qcPath === 'override'
          ? { skipQcGate: true, qcOverrideReason: overrideReason.trim() }
          : { skipQcGate: true }),
      })
      res.data.warnings?.forEach((w) => notify.warning(w))
      const promoted = res.data.promotedStages?.length ?? 0
      notify.success(
        promoted > 0
          ? `Stage "${stage.name}" completed — next stage ready`
          : `Stage "${stage.name}" completed`,
      )
      finishClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not complete stage')
    } finally {
      setBusy(false)
    }
  }

  const runHold = async () => {
    if (!stage || qtyInvalid) return
    setBusy(true)
    try {
      await ensureProgressRecorded()
      await holdWorkOrder(workOrderId, {
        reasonCategory: holdReason,
        remarks: holdRemarks.trim() || remarks.trim() || undefined,
        expectedResumeAt: holdExpectedResume || undefined,
      })
      notify.success('Work order put on hold')
      finishClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not hold work order')
    } finally {
      setBusy(false)
    }
  }

  const runQcDecide = async () => {
    if (!activeInspection?.id) {
      notify.error('No open inspection for this stage')
      return
    }
    if (!qcDecision) {
      notify.error('Select a QC decision')
      return
    }
    setBusy(true)
    try {
      const res = await decideInspection(activeInspection.id, {
        decision: qcDecision,
        acceptedQty: qcAccepted !== '' ? Number(qcAccepted) : undefined,
        rejectedQty: qcRejected !== '' ? Number(qcRejected) : undefined,
        remarks: qcRemarks.trim() || undefined,
      })
      const promoted = res.data.promotedStages?.length ?? 0
      if (qcDecision === 'PASS' || qcDecision === 'CONDITIONAL_PASS') {
        notify.success(
          promoted > 0
            ? 'QC approved — next stage is ready'
            : 'QC approved — stage completed',
        )
      } else if (qcDecision === 'HOLD') {
        notify.warning('QC hold recorded — next stage stays blocked until released')
      } else {
        notify.success(`QC ${qcDecision.replace(/_/g, ' ').toLowerCase()} recorded`)
      }
      finishClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'QC decision failed')
    } finally {
      setBusy(false)
    }
  }

  const runOverrideFromQc = async () => {
    if (!stage) return
    if (!overrideReason.trim()) {
      notify.error('Enter an override reason')
      return
    }
    setBusy(true)
    try {
      const res = await completeStage(workOrderId, {
        stageId: stage.id,
        skipQcGate: true,
        qcOverrideReason: overrideReason.trim(),
        remarks: remarks.trim() || undefined,
      })
      res.data.warnings?.forEach((w) => notify.warning(w))
      notify.success(`Stage "${stage.name}" completed (QC override)`)
      finishClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Override failed')
    } finally {
      setBusy(false)
    }
  }

  if (!stage) return null

  const footer =
    step === 'qty' ? (
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => setStep('hold')}>
          Hold
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || qtyInvalid} onClick={() => void runCompleteAndContinue()}>
            {busy
              ? 'Working…'
              : qcPath === 'send'
                ? 'Complete & Send to QC'
                : isPartial
                  ? 'Complete Partial & Continue'
                  : 'Complete & Continue'}
          </Button>
        </div>
      </div>
    ) : step === 'hold' ? (
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => setStep('qty')}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || qtyInvalid} onClick={() => void runHold()}>
            {busy ? 'Holding…' : 'Confirm Hold'}
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => setStep('qty')}>
          Back
        </Button>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {activeInspection ? (
            <Button disabled={busy || !qcDecision} onClick={() => void runQcDecide()}>
              {busy ? 'Submitting…' : 'Submit QC'}
            </Button>
          ) : (
            <Button disabled={busy || !overrideReason.trim()} onClick={() => void runOverrideFromQc()}>
              {busy ? 'Working…' : 'Override & Continue'}
            </Button>
          )}
        </div>
      </div>
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={
        step === 'qty'
          ? 'Enter completed quantities. Partial qty is allowed — the next stage can still open.'
          : step === 'hold'
            ? 'Save any qty entered above, then put the work order on hold.'
            : 'Clear QC to promote the next stage, or override the gate.'
      }
      closeDisabled={busy}
      footer={footer}
    >
      {step === 'qty' ? (
        <div className="grid gap-3">
          <div className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-text">
            <p>
              Planned <span className="font-semibold tabular-nums">{stage.plannedQuantity}</span>
              {' · '}Good so far{' '}
              <span className="font-semibold tabular-nums text-emerald-700">{stage.goodQuantity}</span>
              {remainingGood != null ? (
                <>
                  {' · '}Remaining <span className="font-semibold tabular-nums">{remainingGood}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-erp-muted">
              Rework {stage.reworkQuantity} · Rejected {stage.rejectedQuantity} · Scrap {stage.scrapQuantity}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Good Quantity">
              <Input
                type="number"
                min={0}
                max={remainingGood ?? undefined}
                step="any"
                value={good}
                onChange={(e) => setGood(clampQty(e.target.value, remainingGood))}
              />
            </FormField>
            <FormField label="Rework Quantity">
              <Input
                type="number"
                min={0}
                max={remainingTotal ?? undefined}
                step="any"
                value={rework}
                onChange={(e) => setRework(clampQty(e.target.value, remainingTotal))}
              />
            </FormField>
            <FormField label="Rejected Quantity">
              <Input
                type="number"
                min={0}
                max={remainingTotal ?? undefined}
                step="any"
                value={rejected}
                onChange={(e) => setRejected(clampQty(e.target.value, remainingTotal))}
              />
            </FormField>
            <FormField label="Scrap Quantity">
              <Input
                type="number"
                min={0}
                max={remainingTotal ?? undefined}
                step="any"
                value={scrap}
                onChange={(e) => setScrap(clampQty(e.target.value, remainingTotal))}
              />
            </FormField>
          </div>

          {isPartial ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Partial completion: good will be {projectedGood} of {planned}. Next stage can still open.
            </p>
          ) : null}
          {entryTotal <= 0 && goodSoFar <= 0 ? (
            <p className="text-[12px] text-amber-800">
              No quantity recorded yet — enter qty here, or complete with zero only if that is intentional.
            </p>
          ) : null}
          {hasNegative ? <p className="text-[12px] text-rose-700">Quantities cannot be negative.</p> : null}
          {exceedsGood ? (
            <p className="text-[12px] text-rose-700">Good quantity cannot exceed remaining ({remainingGood}).</p>
          ) : null}
          {!exceedsGood && exceedsTotal ? (
            <p className="text-[12px] text-rose-700">
              Total cannot exceed remaining planned ({remainingTotal}).
            </p>
          ) : null}

          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Next step</p>
            <div className="mt-2 grid gap-2">
              <label className="flex items-start gap-2 text-[13px] text-erp-text">
                <input
                  type="radio"
                  className="mt-1"
                  checked={qcPath === 'continue'}
                  onChange={() => setQcPath('continue')}
                />
                <span>
                  <span className="font-semibold">
                    {qualityRequired ? 'Continue without QC (flexible)' : 'Continue to next stage'}
                  </span>
                  <span className="block text-[12px] text-erp-muted">
                    {qualityRequired
                      ? 'Skip formal QC gate and open the next stage now.'
                      : `Complete now${isPartial ? ' with partial qty' : ''} and open the next stage.`}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-[13px] text-erp-text">
                <input
                  type="radio"
                  className="mt-1"
                  checked={qcPath === 'send'}
                  onChange={() => setQcPath('send')}
                />
                <span>
                  <span className="font-semibold">Send to QC first</span>
                  <span className="block text-[12px] text-erp-muted">
                    Hold this stage in QC pending — approve in this popup to resume the next stage.
                  </span>
                </span>
              </label>
              {qualityRequired ? (
                <label className="flex items-start gap-2 text-[13px] text-erp-text">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={qcPath === 'override'}
                    onChange={() => setQcPath('override')}
                  />
                  <span>
                    <span className="font-semibold">Override QC & continue</span>
                    <span className="block text-[12px] text-erp-muted">
                      Stage requires QC — skip with a reason and open the next stage now.
                    </span>
                  </span>
                </label>
              ) : null}
              {qcPath === 'override' ? (
                <FormField label="Override reason" required>
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    placeholder="Why production may continue without QC clearance…"
                  />
                </FormField>
              ) : null}
            </div>
          </div>

          <FormField label="Remarks">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
      ) : null}

      {step === 'hold' ? (
        <div className="grid gap-3">
          {entryTotal > 0 ? (
            <p className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-text">
              Will record progress first: good {goodN}, rework {reworkN}, rejected {rejectedN}, scrap {scrapN}.
            </p>
          ) : null}
          <FormField label="Reason Category" required>
            <Select
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value as HoldReasonCategory)}
            >
              {HOLD_REASON_CATEGORY_VALUES.map((r) => (
                <option key={r} value={r}>
                  {HOLD_REASON_CATEGORY_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Expected Resume Date">
            <Input
              type="date"
              value={holdExpectedResume}
              onChange={(e) => setHoldExpectedResume(e.target.value)}
            />
          </FormField>
          <FormField label="Remarks">
            <Textarea value={holdRemarks} onChange={(e) => setHoldRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>
      ) : null}

      {step === 'qc' ? (
        <div className="grid gap-3">
          {activeInspection ? (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-950">
                Inspection <span className="font-semibold">{activeInspection.inspectionNumber}</span>
                {' · '}
                {activeInspection.status}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="QC decision" required>
                  <Select
                    value={qcDecision}
                    onChange={(e) => setQcDecision(e.target.value as QualityInspectionDecision | '')}
                  >
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {QC_DECISIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Remarks">
                  <Input value={qcRemarks} onChange={(e) => setQcRemarks(e.target.value)} />
                </FormField>
                <FormField label="Accepted qty">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={qcAccepted}
                    onChange={(e) => setQcAccepted(clampQty(e.target.value, null))}
                  />
                </FormField>
                <FormField label="Rejected qty">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={qcRejected}
                    onChange={(e) => setQcRejected(clampQty(e.target.value, null))}
                  />
                </FormField>
              </div>
              <p className="text-[12px] text-erp-muted">
                Pass / conditional pass completes the stage and opens the next one when routing allows.
              </p>
            </>
          ) : (
            <div className="grid gap-3">
              <p className="text-[13px] text-erp-muted">
                No open inspection was returned. You can override the QC gate to continue.
              </p>
              <FormField label="Override reason" required>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  placeholder="Why production may continue without QC clearance…"
                />
              </FormField>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
