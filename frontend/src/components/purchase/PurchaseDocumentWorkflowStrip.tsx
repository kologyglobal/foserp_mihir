import { useId, useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import {
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  type PurchaseOrderDomainStatus,
} from '@/types/purchaseDomain'
import { cn } from '@/utils/cn'

/**
 * Readable happy-path strip for purchase orders.
 * Domain also has `invoiced` (maps onto Fully Received for strip index) and `cancelled` (off-track).
 */
export const PURCHASE_ORDER_WORKFLOW_STRIP_STEPS = [
  'draft',
  'pending_approval',
  'approved',
  'released',
  'partially_received',
  'fully_received',
  'closed',
] as const satisfies readonly PurchaseOrderDomainStatus[]

export type PurchaseOrderWorkflowStripStep = (typeof PURCHASE_ORDER_WORKFLOW_STRIP_STEPS)[number]

export type PurchaseOrderWorkflowNextActionContext = {
  canApprove?: boolean
  canRelease?: boolean
  canSubmit?: boolean
  canCreateGrn?: boolean
  canClose?: boolean
  canCreateInvoice?: boolean
}

export function purchaseOrderWorkflowStripIndex(
  status: PurchaseOrderDomainStatus,
): number {
  if (status === 'cancelled') return -1
  if (status === 'invoiced') {
    return PURCHASE_ORDER_WORKFLOW_STRIP_STEPS.indexOf('fully_received')
  }
  return PURCHASE_ORDER_WORKFLOW_STRIP_STEPS.indexOf(status as PurchaseOrderWorkflowStripStep)
}

export function purchaseOrderWorkflowNextAction(
  status: PurchaseOrderDomainStatus,
  ctx: PurchaseOrderWorkflowNextActionContext = {},
): string {
  switch (status) {
    case 'draft':
      return ctx.canSubmit === false ? 'Save draft (submit permission required)' : 'Submit for Approval'
    case 'pending_approval':
      return ctx.canApprove === false ? 'Awaiting Approval' : 'Approve Purchase Order'
    case 'approved':
      return ctx.canRelease === false ? 'Await Release' : 'Release Purchase Order'
    case 'released':
      return ctx.canCreateGrn === false ? 'Await receipt' : 'Record GRN / await receipt'
    case 'partially_received':
      return ctx.canCreateGrn === false
        ? 'Continue receiving (when permitted) / Close when done'
        : 'Continue receiving / Close when done'
    case 'fully_received':
      return ctx.canCreateInvoice === false
        ? 'Create invoice when permitted / Close order'
        : 'Create Purchase Invoice / Close order'
    case 'invoiced':
      return ctx.canClose === false ? 'Await close' : 'Close Purchase Order'
    case 'closed':
      return 'Complete — no further action'
    case 'cancelled':
      return 'Order cancelled — workflow stopped'
    default:
      return '—'
  }
}

const DEFAULT_PO_PURPOSE =
  'Purchase orders — create, approve and release, then track delivery.'

export type PurchaseDocumentWorkflowStripProps = {
  status: PurchaseOrderDomainStatus
  nextAction?: string
  nextActionContext?: PurchaseOrderWorkflowNextActionContext
  /** Shown in the info hover tip (replaces bulky status/next-action columns). */
  purpose?: string
  className?: string
  dense?: boolean
}

/**
 * Compact lifecycle stepper. Status + next action + purpose live in an info tip
 * so the strip does not waste a full meta row (status already shows in the header).
 */
export function PurchaseDocumentWorkflowStrip({
  status,
  nextAction,
  nextActionContext,
  purpose = DEFAULT_PO_PURPOSE,
  className,
  dense = true,
}: PurchaseDocumentWorkflowStripProps) {
  const tipId = useId()
  const [tipOpen, setTipOpen] = useState(false)
  const activeIndex = purchaseOrderWorkflowStripIndex(status)
  const statusLabel = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status]
  const derivedNext = nextAction ?? purchaseOrderWorkflowNextAction(status, nextActionContext)
  const cancelled = status === 'cancelled'

  return (
    <section
      className={cn('po-workflow-strip', dense && 'po-workflow-strip--dense', className)}
      aria-label="Purchase order workflow"
    >
      <div className="po-workflow-strip__row">
        <ol className="po-workflow-strip__track" aria-label="Lifecycle stages">
          {PURCHASE_ORDER_WORKFLOW_STRIP_STEPS.map((step, index) => {
            const label = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[step]
            const isCurrent = !cancelled && index === activeIndex
            const isComplete = !cancelled && activeIndex >= 0 && index < activeIndex
            const isUpcoming = cancelled || activeIndex < 0 || index > activeIndex

            return (
              <li key={step} className="po-workflow-strip__item">
                {index > 0 ? (
                  <ChevronRight
                    className={cn(
                      'po-workflow-strip__connector',
                      isComplete && 'po-workflow-strip__connector--done',
                      isCurrent && 'po-workflow-strip__connector--current',
                    )}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'po-workflow-strip__step',
                    isComplete && 'po-workflow-strip__step--complete',
                    isCurrent && 'po-workflow-strip__step--current',
                    isUpcoming && 'po-workflow-strip__step--upcoming',
                    cancelled && 'po-workflow-strip__step--cancelled',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className="po-workflow-strip__step-index" aria-hidden>
                    {isComplete ? '✓' : index + 1}
                  </span>
                  <span className="po-workflow-strip__step-label">{label}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <div
          className="po-workflow-strip__guide"
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
          onFocus={() => setTipOpen(true)}
          onBlur={() => setTipOpen(false)}
        >
          <button
            type="button"
            className="po-workflow-strip__guide-btn"
            aria-describedby={tipOpen ? tipId : undefined}
            aria-expanded={tipOpen}
            aria-label="Document guidance"
          >
            <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {tipOpen ? (
            <div id={tipId} role="tooltip" className="po-workflow-strip__tooltip">
              <p>
                <span className="po-workflow-strip__tooltip-label">Purpose</span>
                {purpose}
              </p>
              <p>
                <span className="po-workflow-strip__tooltip-label">Status</span>
                {statusLabel}
              </p>
              <p>
                <span className="po-workflow-strip__tooltip-label">Next</span>
                {derivedNext}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {status === 'invoiced' ? (
        <p className="po-workflow-strip__note">
          Invoiced (after Fully Received) — close when settlement is done.
        </p>
      ) : null}
      {cancelled ? (
        <p className="po-workflow-strip__note po-workflow-strip__note--danger">
          Cancelled orders leave the happy-path workflow.
        </p>
      ) : null}
    </section>
  )
}
