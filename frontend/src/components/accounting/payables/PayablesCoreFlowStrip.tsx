import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

/**
 * Core AP operating flow — highlights the three primary workspaces:
 * Vendor Outstanding → Payment Planning → Invoice Allocation.
 * Upstream (invoice match/approval) and downstream (posting/ledger) are contextual links.
 */
const CORE_STEPS = [
  {
    id: 'invoice',
    label: 'Invoice & Match',
    path: '/accounting/payables/invoices',
    tier: 'upstream' as const,
  },
  {
    id: 'outstanding',
    label: 'Vendor Outstanding',
    path: '/accounting/payables/outstanding',
    tier: 'primary' as const,
  },
  {
    id: 'planning',
    label: 'Payment Planning',
    path: '/accounting/payables/payment-planning',
    tier: 'primary' as const,
  },
  {
    id: 'proposal',
    label: 'Proposal Approval',
    path: '/accounting/payables/payment-proposals',
    tier: 'mid' as const,
  },
  {
    id: 'payment',
    label: 'Vendor Payment',
    path: '/accounting/payables/payments',
    tier: 'mid' as const,
  },
  {
    id: 'allocation',
    label: 'Invoice Allocation',
    path: '/accounting/payables/allocations',
    tier: 'primary' as const,
  },
  {
    id: 'ledger',
    label: 'Ledger / Bank',
    path: '/accounting/ledger-entries',
    tier: 'downstream' as const,
  },
] as const

export type PayablesCoreFlowStepId = (typeof CORE_STEPS)[number]['id']

export function PayablesCoreFlowStrip({
  active,
  className,
}: {
  active: PayablesCoreFlowStepId
  className?: string
}) {
  return (
    <nav
      aria-label="Core payables flow"
      className={cn(
        'mb-3 overflow-x-auto rounded-lg border border-erp-border bg-white px-2 py-2',
        className,
      )}
    >
      <ol className="flex min-w-max items-center gap-1">
        {CORE_STEPS.map((step, index) => {
          const isActive = step.id === active
          const isPrimary = step.tier === 'primary'
          return (
            <li key={step.id} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="px-0.5 text-[11px] text-erp-muted" aria-hidden>
                  →
                </span>
              ) : null}
              <Link
                to={step.path}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
                  isActive && isPrimary && 'bg-erp-primary text-white',
                  isActive && !isPrimary && 'bg-erp-primary-soft text-erp-primary ring-1 ring-erp-primary/30',
                  !isActive && isPrimary && 'bg-erp-surface-alt text-erp-text hover:bg-erp-primary-soft hover:text-erp-primary',
                  !isActive && !isPrimary && 'text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text',
                )}
              >
                {step.label}
              </Link>
            </li>
          )
        })}
      </ol>
      <p className="mt-1.5 px-1 text-[10px] text-erp-muted">
        Primary workspaces: <span className="font-semibold text-erp-text">Outstanding</span>,{' '}
        <span className="font-semibold text-erp-text">Payment Planning</span>,{' '}
        <span className="font-semibold text-erp-text">Invoice Allocation</span>
        . Ledger and bank posting remain demo-linked until finance APIs connect.
      </p>
    </nav>
  )
}
