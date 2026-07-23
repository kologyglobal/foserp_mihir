import { useId, useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import {
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  RFQ_DOMAIN_STATUS_LABELS,
  type PurchaseOrderDomainStatus,
  type PurchaseRequisitionStatus,
  type RfqDomainStatus,
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

/** Happy-path for RFQ-required requisitions. */
export const PURCHASE_REQUISITION_RFQ_WORKFLOW_STEPS = [
  'draft',
  'pending_approval',
  'approved',
  'converted_to_rfq',
  'closed',
] as const satisfies readonly PurchaseRequisitionStatus[]

/** Happy-path for direct purchase planning (no RFQ). */
export const PURCHASE_REQUISITION_DIRECT_WORKFLOW_STEPS = [
  'draft',
  'pending_approval',
  'approved',
  'converted_to_po',
  'closed',
] as const satisfies readonly PurchaseRequisitionStatus[]

export type PurchaseRequisitionWorkflowNextActionContext = {
  canSubmit?: boolean
  canCreateRfq?: boolean
  canOpenPlanning?: boolean
}

export function purchaseRequisitionWorkflowSteps(
  rfqRequired: boolean,
): readonly PurchaseRequisitionStatus[] {
  return rfqRequired
    ? PURCHASE_REQUISITION_RFQ_WORKFLOW_STEPS
    : PURCHASE_REQUISITION_DIRECT_WORKFLOW_STEPS
}

export function purchaseRequisitionWorkflowStripIndex(
  status: PurchaseRequisitionStatus,
  rfqRequired: boolean,
): number {
  if (status === 'cancelled' || status === 'rejected') return -1
  const steps = purchaseRequisitionWorkflowSteps(rfqRequired)
  return steps.indexOf(status as (typeof steps)[number])
}

export function purchaseRequisitionWorkflowNextAction(
  status: PurchaseRequisitionStatus,
  rfqRequired: boolean,
  ctx: PurchaseRequisitionWorkflowNextActionContext = {},
): string {
  switch (status) {
    case 'draft':
      return ctx.canSubmit === false
        ? 'Save draft (submit permission required)'
        : 'Submit for Approval'
    case 'pending_approval':
      return 'Awaiting Approval'
    case 'approved':
      if (rfqRequired) {
        return ctx.canCreateRfq === false
          ? 'Await RFQ creation'
          : 'Create RFQ from this requisition'
      }
      return ctx.canOpenPlanning === false
        ? 'Await Purchase Planning'
        : 'Open Purchase Planning Sheet'
    case 'converted_to_rfq':
      return 'Continue RFQ / vendor quotation'
    case 'converted_to_po':
      return 'PO created — track on Purchase Order'
    case 'closed':
      return 'Complete — no further action'
    case 'rejected':
      return 'Revise and resubmit'
    case 'cancelled':
      return 'Requisition cancelled — workflow stopped'
    default:
      return '—'
  }
}

const DEFAULT_PR_PURPOSE =
  'Purchase requisitions — request, approve, then source via RFQ or direct planning.'

export type PurchaseRequisitionWorkflowStripProps = {
  status: PurchaseRequisitionStatus
  rfqRequired: boolean
  nextAction?: string
  nextActionContext?: PurchaseRequisitionWorkflowNextActionContext
  purpose?: string
  className?: string
  dense?: boolean
}

/** Compact PR lifecycle stepper — same chrome as PO strip. */
export function PurchaseRequisitionWorkflowStrip({
  status,
  rfqRequired,
  nextAction,
  nextActionContext,
  purpose = DEFAULT_PR_PURPOSE,
  className,
  dense = true,
}: PurchaseRequisitionWorkflowStripProps) {
  const tipId = useId()
  const [tipOpen, setTipOpen] = useState(false)
  const steps = purchaseRequisitionWorkflowSteps(rfqRequired)
  const activeIndex = purchaseRequisitionWorkflowStripIndex(status, rfqRequired)
  const statusLabel = PURCHASE_REQUISITION_STATUS_LABELS[status]
  const derivedNext =
    nextAction ?? purchaseRequisitionWorkflowNextAction(status, rfqRequired, nextActionContext)
  const offTrack = status === 'cancelled' || status === 'rejected'

  return (
    <section
      className={cn('po-workflow-strip', dense && 'po-workflow-strip--dense', className)}
      aria-label="Purchase requisition workflow"
    >
      <div className="po-workflow-strip__row">
        <ol className="po-workflow-strip__track" aria-label="Lifecycle stages">
          {steps.map((step, index) => {
            const label = PURCHASE_REQUISITION_STATUS_LABELS[step]
            const isCurrent = !offTrack && index === activeIndex
            const isComplete = !offTrack && activeIndex >= 0 && index < activeIndex
            const isUpcoming = offTrack || activeIndex < 0 || index > activeIndex

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
                    offTrack && 'po-workflow-strip__step--cancelled',
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

      {status === 'rejected' ? (
        <p className="po-workflow-strip__note po-workflow-strip__note--danger">
          Rejected — revise the requisition and resubmit for approval.
        </p>
      ) : null}
      {status === 'cancelled' ? (
        <p className="po-workflow-strip__note po-workflow-strip__note--danger">
          Cancelled requisitions leave the happy-path workflow.
        </p>
      ) : null}
    </section>
  )
}

/** Happy-path for RFQ lifecycle. */
export const RFQ_WORKFLOW_STRIP_STEPS = [
  'draft',
  'sent',
  'partially_quoted',
  'quotation_received',
  'under_evaluation',
  'closed',
] as const satisfies readonly RfqDomainStatus[]

export type RfqWorkflowNextActionContext = {
  canSend?: boolean
  canCompare?: boolean
}

export function rfqWorkflowStripIndex(status: RfqDomainStatus): number {
  if (status === 'cancelled') return -1
  return RFQ_WORKFLOW_STRIP_STEPS.indexOf(status as (typeof RFQ_WORKFLOW_STRIP_STEPS)[number])
}

export function rfqWorkflowNextAction(
  status: RfqDomainStatus,
  ctx: RfqWorkflowNextActionContext = {},
): string {
  switch (status) {
    case 'draft':
      return ctx.canSend === false ? 'Save draft (send permission required)' : 'Send RFQ to vendors'
    case 'sent':
      return 'Await vendor quotations'
    case 'partially_quoted':
      return ctx.canCompare === false
        ? 'Collect remaining quotations'
        : 'Collect remaining quotes or Compare'
    case 'quotation_received':
      return ctx.canCompare === false ? 'Await comparison' : 'Compare Quotations'
    case 'under_evaluation':
      return ctx.canCompare === false ? 'Complete evaluation' : 'Compare / select vendor'
    case 'closed':
      return 'Complete — no further action'
    case 'cancelled':
      return 'RFQ cancelled — workflow stopped'
    default:
      return '—'
  }
}

const DEFAULT_RFQ_PURPOSE =
  'RFQs — invite vendors, collect quotations, then compare and select.'

export type RfqWorkflowStripProps = {
  status: RfqDomainStatus
  nextAction?: string
  nextActionContext?: RfqWorkflowNextActionContext
  purpose?: string
  className?: string
  dense?: boolean
}

/** Compact RFQ lifecycle stepper — same chrome as PO / PR strips. */
export function RfqWorkflowStrip({
  status,
  nextAction,
  nextActionContext,
  purpose = DEFAULT_RFQ_PURPOSE,
  className,
  dense = true,
}: RfqWorkflowStripProps) {
  const tipId = useId()
  const [tipOpen, setTipOpen] = useState(false)
  const activeIndex = rfqWorkflowStripIndex(status)
  const statusLabel = RFQ_DOMAIN_STATUS_LABELS[status]
  const derivedNext = nextAction ?? rfqWorkflowNextAction(status, nextActionContext)
  const cancelled = status === 'cancelled'

  return (
    <section
      className={cn('po-workflow-strip', dense && 'po-workflow-strip--dense', className)}
      aria-label="RFQ workflow"
    >
      <div className="po-workflow-strip__row">
        <ol className="po-workflow-strip__track" aria-label="Lifecycle stages">
          {RFQ_WORKFLOW_STRIP_STEPS.map((step, index) => {
            const label = RFQ_DOMAIN_STATUS_LABELS[step]
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

      {cancelled ? (
        <p className="po-workflow-strip__note po-workflow-strip__note--danger">
          Cancelled RFQs leave the happy-path workflow.
        </p>
      ) : null}
    </section>
  )
}
