import { useState } from 'react'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  decideInspection,
  type QualityInspection,
  type QualityInspectionDecision,
} from '@/services/api/qualityApi'
import type { ProductionOrderStage } from '@/types/manufacturingProduction'
import { notify } from '@/store/toastStore'

const DECISION_OPTIONS: Array<{ value: QualityInspectionDecision; label: string }> = [
  { value: 'PASS', label: 'Passed' },
  { value: 'CONDITIONAL_PASS', label: 'Conditionally Accepted' },
  { value: 'REWORK', label: 'Rework' },
  { value: 'REJECT', label: 'Failed / Rejected' },
  { value: 'HOLD', label: 'Pending / Hold' },
]

interface StageQcPanelProps {
  workOrderId: string
  stage: ProductionOrderStage
  inspection?: QualityInspection | null
  busy?: boolean
  canExecute?: boolean
  onChanged: () => void
  onOverrideComplete: (stageId: string, stageName: string, reason: string) => void
}

/** Inline QC + override for flexible Work Order execution (no Quality module navigation required). */
export function StageQcPanel({
  workOrderId: _workOrderId,
  stage,
  inspection,
  busy,
  canExecute,
  onChanged,
  onOverrideComplete,
}: StageQcPanelProps) {
  const [decision, setDecision] = useState<QualityInspectionDecision | ''>('')
  const [acceptedQty, setAcceptedQty] = useState('')
  const [rejectedQty, setRejectedQty] = useState('')
  const [remarks, setRemarks] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!stage.qualityRequired && stage.status !== 'QC_PENDING') return null

  const submitQc = async () => {
    if (!inspection?.id) {
      notify.error('No open inspection for this stage — use Override & Complete Stage, or complete stage to create QC.')
      return
    }
    if (!decision) {
      notify.error('Select a QC decision')
      return
    }
    setSubmitting(true)
    try {
      await decideInspection(inspection.id, {
        decision,
        acceptedQty: acceptedQty !== '' ? Number(acceptedQty) : undefined,
        rejectedQty: rejectedQty !== '' ? Number(rejectedQty) : undefined,
        remarks: remarks.trim() || undefined,
      })
      notify.success(`QC ${decision.replace(/_/g, ' ').toLowerCase()} recorded`)
      setDecision('')
      setRemarks('')
      onChanged()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'QC decision failed')
    } finally {
      setSubmitting(false)
    }
  }

  const override = () => {
    const reason = overrideReason.trim()
    if (!reason) {
      notify.error('Enter an override reason')
      return
    }
    onOverrideComplete(stage.id, stage.name, reason)
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">Stage QC</p>
          <p className="text-[12px] text-erp-muted">
            {inspection
              ? `Inspection ${inspection.inspectionNumber} · ${inspection.status}`
              : 'QC required — complete/override without leaving the Work Order'}
          </p>
        </div>
      </div>

      {inspection ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="QC status">
            <Select value={decision} onChange={(e) => setDecision(e.target.value as QualityInspectionDecision | '')}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {DECISION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Accepted qty">
            <Input type="number" min={0} step="any" value={acceptedQty} onChange={(e) => setAcceptedQty(e.target.value)} />
          </FormField>
          <FormField label="Rejected qty">
            <Input type="number" min={0} step="any" value={rejectedQty} onChange={(e) => setRejectedQty(e.target.value)} />
          </FormField>
          <FormField label="Remarks">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Inspection remarks" />
          </FormField>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              size="sm"
              disabled={busy || submitting || !canExecute}
              onClick={() => void submitQc()}
            >
              {submitting ? 'Submitting…' : 'Submit QC'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 border-t border-amber-200/80 pt-3">
        <p className="text-[11px] font-semibold text-erp-muted">Override QC gate (flexible execution)</p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField label="Override reason" className="min-w-0 flex-1">
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              placeholder="Why production may continue without formal QC clearance…"
            />
          </FormField>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || submitting || !canExecute}
            onClick={override}
          >
            Override & Complete Stage
          </Button>
        </div>
      </div>
    </div>
  )
}
