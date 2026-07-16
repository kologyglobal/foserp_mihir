import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSalesStore } from '@/store/salesStore'
import { resolveStoreAction } from '@/store/storeAction'
import { LEAD_STAGE_FLOW, type LeadStage } from '@/types/sales'
import { leadStageLabel } from '@/utils/leadUtils'
import { cn } from '@/utils/cn'

/** Stages that need dedicated Convert / Close workflows — omit from quick picker. */
const STAGE_PICKER_EXCLUDE = new Set<LeadStage>(['converted_to_opportunity'])

export function LeadChangeStageControl({
  leadId,
  currentStage,
  disabled,
  onDone,
  className,
}: {
  leadId: string
  currentStage: LeadStage
  disabled?: boolean
  onDone?: (message: string) => void
  className?: string
}) {
  const advanceLeadStage = useSalesStore((s) => s.advanceLeadStage)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const options = (LEAD_STAGE_FLOW[currentStage] ?? []).filter((s) => !STAGE_PICKER_EXCLUDE.has(s))

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
    setBusy(true)
    try {
      const r = await resolveStoreAction(advanceLeadStage(leadId, stage))
      if (r.ok) {
        onDone?.(`Stage updated to ${leadStageLabel(stage)}`)
        setOpen(false)
      } else {
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
          {options.map((stage) => (
            <button
              key={stage}
              type="button"
              role="menuitem"
              className={cn(
                'lead-change-stage__item',
                (stage === 'not_qualified' || stage === 'closed') && 'lead-change-stage__item--danger',
              )}
              disabled={busy}
              onClick={() => void changeTo(stage)}
            >
              {leadStageLabel(stage)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
