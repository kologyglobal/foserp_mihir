import { cn } from '@/utils/cn'
import type { VoucherLifecycleStatus } from '@/types/vouchers'
import { VOUCHER_WORKFLOW_STEPS, workflowStepIndex } from './voucherStatusRules'

export function VoucherWorkflowStrip({
  status,
  className,
}: {
  status: VoucherLifecycleStatus
  className?: string
}) {
  const active = workflowStepIndex(status)
  const terminal =
    status === 'reversed' || status === 'cancelled' || status === 'rejected' || status === 'sent_back'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border border-erp-border bg-erp-surface-alt/50 px-3 py-2 text-[12px]',
        className,
      )}
      aria-label="Voucher workflow"
    >
      {VOUCHER_WORKFLOW_STEPS.map((step, i) => {
        const done = active > i || (active === i && status === 'posted')
        const current = active === i && !terminal
        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 ? <span className="text-erp-muted" aria-hidden>→</span> : null}
            <span
              className={cn(
                'inline-flex items-center rounded px-2 py-0.5 font-medium ring-1 ring-inset',
                done || current
                  ? 'bg-sky-50 text-sky-900 ring-sky-200'
                  : 'bg-white text-erp-muted ring-erp-border',
                current && 'ring-2 ring-sky-400',
              )}
            >
              {step.label}
            </span>
          </div>
        )
      })}
      {terminal ? (
        <span className="ml-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-900 ring-1 ring-amber-200">
          {status === 'sent_back'
            ? 'Sent back'
            : status === 'rejected'
              ? 'Rejected'
              : status === 'reversed'
                ? 'Reversed'
                : 'Cancelled'}
        </span>
      ) : null}
    </div>
  )
}
