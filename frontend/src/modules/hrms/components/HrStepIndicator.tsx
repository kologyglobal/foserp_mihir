import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface HrStep {
  id: string
  label: string
  done: boolean
  current?: boolean
  /** e.g. blocked reason — shown as a small note under the step. */
  note?: string
}

interface HrStepIndicatorProps {
  steps: HrStep[]
  className?: string
}

/** Guided-process step strip — payroll run lifecycle, exit → clearance → settlement → payment, etc. */
export function HrStepIndicator({ steps, className }: HrStepIndicatorProps) {
  return (
    <ol className={cn('hr-step-indicator', className)}>
      {steps.map((step, idx) => (
        <li
          key={step.id}
          className={cn(
            'hr-step-indicator__step',
            step.done && 'hr-step-indicator__step--done',
            step.current && !step.done && 'hr-step-indicator__step--current',
          )}
        >
          <span className="hr-step-indicator__dot" aria-hidden>
            {step.done ? <Check className="h-3 w-3" /> : <span className="hr-step-indicator__dot-index">{idx + 1}</span>}
          </span>
          <span className="hr-step-indicator__label">
            {step.label}
            {step.note ? <span className="hr-step-indicator__note">{step.note}</span> : null}
          </span>
          {idx < steps.length - 1 ? <span className="hr-step-indicator__connector" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  )
}
