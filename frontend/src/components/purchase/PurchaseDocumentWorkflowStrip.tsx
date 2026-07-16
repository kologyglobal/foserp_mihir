import { ChevronRight } from 'lucide-react'
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
  /** Can approve PO (permission). */
  canApprove?: boolean
  /** Can release PO (permission). */
  canRelease?: boolean
  /** Can submit draft (permission). */
  canSubmit?: boolean
  /** Can create GRN (permission). */
  canCreateGrn?: boolean
  /** Can close PO (permission). */
  canClose?: boolean
  /** Can create purchase invoice (permission). */
  canCreateInvoice?: boolean
}

export function purchaseOrderWorkflowStripIndex(
  status: PurchaseOrderDomainStatus,
): number {
  if (status === 'cancelled') return -1
  // Invoiced sits after full receipt; keep strip readable without an 8th step.
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

export type PurchaseDocumentWorkflowStripProps = {
  status: PurchaseOrderDomainStatus
  /** Override derived next-action copy. */
  nextAction?: string
  nextActionContext?: PurchaseOrderWorkflowNextActionContext
  className?: string
  /** Compact density for editor chrome. */
  dense?: boolean
}

/**
 * Document lifecycle strip — stronger than a status badge alone.
 * Prefer on PO editor + detail; reusable later for similar purchase docs.
 */
export function PurchaseDocumentWorkflowStrip({
  status,
  nextAction,
  nextActionContext,
  className,
  dense = true,
}: PurchaseDocumentWorkflowStripProps) {
  const activeIndex = purchaseOrderWorkflowStripIndex(status)
  const statusLabel = PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status]
  const derivedNext = nextAction ?? purchaseOrderWorkflowNextAction(status, nextActionContext)
  const cancelled = status === 'cancelled'

  return (
    <section
      className={cn('po-workflow-strip', dense && 'po-workflow-strip--dense', className)}
      aria-label="Purchase order workflow"
    >
      <div className="po-workflow-strip__meta">
        <div className="po-workflow-strip__meta-block">
          <span className="po-workflow-strip__eyebrow">Current status</span>
          <p className="po-workflow-strip__status">{statusLabel}</p>
        </div>
        <div className="po-workflow-strip__meta-block po-workflow-strip__meta-block--next">
          <span className="po-workflow-strip__eyebrow">Next action</span>
          <p className="po-workflow-strip__next">{derivedNext}</p>
        </div>
      </div>

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
