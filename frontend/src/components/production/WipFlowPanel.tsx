import { ArrowDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { getWipFlowStepIndex, type WipFlowStep } from '../../utils/wipFlow'

interface WipFlowPanelProps {
  steps: WipFlowStep[]
  currentStepId: string
  className?: string
}

export function WipFlowPanel({ steps, currentStepId, className }: WipFlowPanelProps) {
  const activeIdx = getWipFlowStepIndex(steps, currentStepId)

  return (
    <div className={cn('rounded-md border border-erp-border bg-erp-surface p-4 shadow-erp', className)}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
        Material Flow (routing-driven WIP)
      </p>
      <div className="flex flex-col items-stretch gap-0">
        {steps.map((step, idx) => {
          const isActive = idx === activeIdx
          const isPast = idx < activeIdx
          const isLast = idx === steps.length - 1

          return (
            <div key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  'w-full rounded-sm border px-4 py-2.5 text-center text-[13px] font-medium transition-colors',
                  isActive && 'border-erp-primary bg-erp-primary-soft text-erp-primary shadow-sm',
                  isPast && !isActive && 'border-erp-success/30 bg-green-50/80 text-erp-success',
                  !isActive && !isPast && 'border-erp-border bg-erp-surface-alt text-erp-muted',
                )}
              >
                {step.label}
                {step.operationName && (
                  <span className="mt-0.5 block text-[10px] font-normal opacity-70">{step.operationName}</span>
                )}
                {step.warehouseCode && (
                  <span className="mt-0.5 block font-mono text-[10px] font-normal opacity-70">
                    {step.warehouseCode}
                  </span>
                )}
              </div>
              {!isLast && (
                <ArrowDown
                  className={cn(
                    'my-1 h-4 w-4 shrink-0',
                    isPast ? 'text-erp-success' : 'text-erp-muted/50',
                  )}
                  aria-hidden
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
