import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'

export type ReconFlowStepId =
  | 'setup'
  | 'transactions'
  | 'import'
  | 'validate'
  | 'automatch'
  | 'manual'
  | 'difference'
  | 'approval'
  | 'complete'

const STEPS: { id: ReconFlowStepId; label: string; short: string }[] = [
  { id: 'setup', label: 'Account Setup', short: 'Setup' },
  { id: 'transactions', label: 'Receipts & Transfers', short: 'Txns' },
  { id: 'import', label: 'Statement Import', short: 'Import' },
  { id: 'validate', label: 'Validation', short: 'Validate' },
  { id: 'automatch', label: 'Auto-Match', short: 'Auto' },
  { id: 'manual', label: 'Manual Match', short: 'Manual' },
  { id: 'difference', label: 'Difference Review', short: 'Diff' },
  { id: 'approval', label: 'Approval', short: 'Approve' },
  { id: 'complete', label: 'Completion', short: 'Done' },
]

/**
 * Recommended Bank & Cash reconciliation journey — visual guide for BC-style workspaces.
 */
export function ReconciliationFlowStrip({
  active,
  completedThrough,
  compact,
  className,
}: {
  active?: ReconFlowStepId
  /** Last step considered done (inclusive). */
  completedThrough?: ReconFlowStepId
  compact?: boolean
  className?: string
}) {
  const activeIdx = active ? STEPS.findIndex((s) => s.id === active) : -1
  const doneIdx = completedThrough ? STEPS.findIndex((s) => s.id === completedThrough) : -1

  return (
    <nav
      aria-label="Recommended bank reconciliation flow"
      className={cn(
        'overflow-x-auto rounded-md border border-erp-border bg-white px-2 py-2',
        className,
      )}
    >
      <ol className="flex min-w-max items-center gap-0">
        {STEPS.map((step, i) => {
          const done = doneIdx >= i
          const current = activeIdx === i
          return (
            <li key={step.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1',
                  current && 'bg-erp-primary-soft ring-1 ring-erp-primary/30',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    done || current
                      ? 'bg-erp-primary text-white'
                      : 'bg-erp-surface-alt text-erp-muted ring-1 ring-erp-border',
                  )}
                  aria-hidden
                >
                  {done && !current ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    current ? 'text-erp-primary' : done ? 'text-erp-text' : 'text-erp-muted',
                  )}
                >
                  {compact ? step.short : step.label}
                </span>
              </div>
              {i < STEPS.length - 1 ? (
                <span className={cn('mx-0.5 h-px w-3 sm:w-5', done ? 'bg-erp-primary/50' : 'bg-erp-border')} aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
