import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSalesStore } from '@/store/salesStore'
import { resolveStoreAction } from '@/store/storeAction'
import { LEAD_STAGE_FLOW, type LeadStage } from '@/types/sales'
import { leadStageLabel } from '@/utils/leadUtils'
import {
  formatMissingStageFieldsMessage,
  getMissingLeadStageFields,
  type StageRequirementField,
} from '@/config/crmStageRequirements'
import { canCrmPermission } from '@/utils/permissions/crm'
import { cn } from '@/utils/cn'

/** Stages that need dedicated Convert / Close workflows — omit from quick picker. */
const STAGE_PICKER_EXCLUDE = new Set<LeadStage>(['converted_to_opportunity'])

function canSelectLeadStage(stage: LeadStage): boolean {
  if (stage === 'qualified' || stage === 'not_qualified') {
    return canCrmPermission('crm.lead.qualify')
  }
  return canCrmPermission('crm.lead.update')
}

export function LeadChangeStageControl({
  leadId,
  currentStage,
  disabled,
  onDone,
  onBlocked,
  className,
}: {
  leadId: string
  currentStage: LeadStage
  disabled?: boolean
  onDone?: (message: string) => void
  /** Fired when a target stage is blocked by incomplete mandatory fields (or API gate). */
  onBlocked?: (missing: StageRequirementField[], targetStage: LeadStage) => void
  className?: string
}) {
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)
  const getLead = useSalesStore((s) => s.getLead)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options = (LEAD_STAGE_FLOW[currentStage] ?? [])
    .filter((s) => !STAGE_PICKER_EXCLUDE.has(s))
    .filter((s) => canSelectLeadStage(s))

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (disabled || options.length === 0) return null

  async function changeTo(stage: LeadStage) {
    const lead = getLead(leadId)
    // Qualify never blocks on product / value / other fields.
    if (lead && stage !== 'qualified') {
      const missing = getMissingLeadStageFields(lead, stage)
      if (missing.length > 0) {
        onBlocked?.(missing, stage)
        onDone?.(formatMissingStageFieldsMessage(missing, leadStageLabel(stage)))
        setOpen(false)
        return
      }
    }

    setBusy(true)
    try {
      const r = await resolveStoreAction(advanceLeadStage(leadId, stage))
      if (r.ok) {
        onDone?.(`Stage updated to ${leadStageLabel(stage)}`)
        setOpen(false)
      } else {
        if (r.missingFields?.length) {
          onBlocked?.(r.missingFields, stage)
        }
        onDone?.(r.error ?? 'Could not change stage')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('lead-change-stage', className)} ref={ref}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="lead-change-stage__trigger"
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Change Stage
        <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" aria-hidden />
      </Button>
      {open ? (
        <div className="lead-change-stage__menu" role="menu">
          <p className="lead-change-stage__menu-hint">Move to</p>
          {options.map((stage) => {
            const lead = getLead(leadId)
            const incomplete =
              stage !== 'qualified' && lead
                ? getMissingLeadStageFields(lead, stage).length > 0
                : false
            return (
              <button
                key={stage}
                type="button"
                role="menuitem"
                className={cn(
                  'lead-change-stage__item',
                  (stage === 'not_qualified' || stage === 'closed') && 'lead-change-stage__item--danger',
                )}
                disabled={busy || incomplete}
                title={incomplete ? 'Complete mandatory fields first' : undefined}
                onClick={() => void changeTo(stage)}
              >
                {leadStageLabel(stage)}
                {incomplete ? ' · incomplete' : ''}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
