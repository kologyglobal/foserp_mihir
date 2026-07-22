import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { IMPORT_WIZARD_STEPS } from '../utils/bankStatementUi'

export function ImportWizardSteps({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex flex-wrap gap-1 rounded-lg border border-erp-border bg-white p-2">
      {IMPORT_WIZARD_STEPS.map((step) => {
        const done = step.id < currentStep
        const active = step.id === currentStep
        return (
          <li
            key={step.id}
            className={cn(
              'flex min-w-[7rem] flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold',
              active && 'bg-erp-primary/10 text-erp-primary',
              done && !active && 'text-emerald-700',
              !active && !done && 'text-erp-muted',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                active && 'border-erp-primary bg-erp-primary text-white',
                done && !active && 'border-emerald-600 bg-emerald-600 text-white',
                !active && !done && 'border-erp-border',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : step.id}
            </span>
            <span className="truncate">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
