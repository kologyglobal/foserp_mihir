import type { QuotationDocumentStatus } from '../types/crm'
import type { CustomerApprovalStatus } from '../types/quotation'

export interface QuotationRevisionPolicyInput {
  status: QuotationDocumentStatus
  customerApproval?: CustomerApprovalStatus | null
  /** Prior / superseded revisions are never revisable from that doc. */
  isLatest?: boolean
}

export interface QuotationRevisionPolicy {
  /** Edit the current document in place (draft path). */
  canDirectEdit: boolean
  /** Create Q(n+1) from this document. */
  canCreateRevision: boolean
  /** Short stage label for banners / steppers. */
  stageTitle: string
  /** Bullet guidance shown under Document workflow. */
  guidance: string[]
  /** Why New Revision is hidden / blocked. */
  disabledReason: string | null
}

/**
 * Quotation revision rules (product):
 * - Draft → direct edit; revision not required
 * - Pending Internal Approval → no revision (reject or recall first)
 * - Approved / Sent / Customer Rejected → new revision available
 * - Customer Approved → revision normally not available
 * - Converted → revision not available
 */
export function resolveQuotationRevisionPolicy(
  input: QuotationRevisionPolicyInput,
): QuotationRevisionPolicy {
  const { status, customerApproval = 'pending', isLatest = true } = input

  if (!isLatest || status === 'superseded') {
    return {
      canDirectEdit: false,
      canCreateRevision: false,
      stageTitle: 'Prior revision',
      guidance: ['This revision is view-only. Open the latest quotation document to edit or revise.'],
      disabledReason: 'Only the latest revision can be revised.',
    }
  }

  if (status === 'converted') {
    return {
      canDirectEdit: false,
      canCreateRevision: false,
      stageTitle: 'Converted to Sales Order',
      guidance: ['Revision not available after conversion.', 'Continue fulfilment from the Sales Order.'],
      disabledReason: 'Revision is not available after conversion to Sales Order.',
    }
  }

  if (status === 'draft') {
    return {
      canDirectEdit: true,
      canCreateRevision: false,
      stageTitle: 'Draft',
      guidance: [
        'Direct edit allowed — update sections and line items on this document.',
        'Revision not required while the quotation is still in draft.',
        'Submit for Internal Approval when commercial content is ready.',
      ],
      disabledReason: 'Revision is not required in Draft — edit this document directly.',
    }
  }

  if (status === 'pending_approval') {
    return {
      canDirectEdit: false,
      canCreateRevision: false,
      stageTitle: 'Pending Internal Approval',
      guidance: [
        'Revision not available while approval is pending.',
        'Reject the quotation, or Recall to Draft, before making commercial changes.',
      ],
      disabledReason: 'Revision is not available while pending internal approval. Reject or Recall first.',
    }
  }

  if (status === 'rejected') {
    return {
      canDirectEdit: true,
      canCreateRevision: true,
      stageTitle: 'Internally rejected',
      guidance: [
        'New Revision available — create Q(n+1) to address feedback.',
        'You may also edit this rejected draft and resubmit for approval.',
      ],
      disabledReason: null,
    }
  }

  if (status === 'approved') {
    return {
      canDirectEdit: false,
      canCreateRevision: true,
      stageTitle: 'Approved',
      guidance: [
        'New Revision available if commercial terms must change before send.',
        'Otherwise Send to Customer to continue the workflow.',
      ],
      disabledReason: null,
    }
  }

  if (status === 'sent') {
    if (customerApproval === 'approved') {
      return {
        canDirectEdit: false,
        canCreateRevision: false,
        stageTitle: 'Customer Approved',
        guidance: [
          'New Revision normally not available after customer approval.',
          'Convert to Sales Order to continue, or contact an admin if a rare commercial reset is required.',
        ],
        disabledReason: 'New Revision is normally not available after customer approval.',
      }
    }
    if (customerApproval === 'rejected') {
      return {
        canDirectEdit: false,
        canCreateRevision: true,
        stageTitle: 'Customer Rejected',
        guidance: [
          'New Revision available — revise commercial terms and resend.',
        ],
        disabledReason: null,
      }
    }
    return {
      canDirectEdit: false,
      canCreateRevision: true,
      stageTitle: 'Sent',
      guidance: [
        'New Revision available if the customer requests changes before approval.',
        'Record Customer Approved when the customer confirms.',
      ],
      disabledReason: null,
    }
  }

  return {
    canDirectEdit: false,
    canCreateRevision: false,
    stageTitle: 'Quotation',
    guidance: [],
    disabledReason: 'Revision is not available in the current status.',
  }
}
