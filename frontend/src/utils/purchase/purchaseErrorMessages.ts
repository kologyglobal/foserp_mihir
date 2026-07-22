/**
 * User-facing purchase error messages keyed by stable API codes.
 * Keep in sync with `backend/src/modules/purchase/shared/purchase-error-catalog.ts`.
 */

export const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  PR_NOT_FOUND: 'Purchase requisition not found.',
  PR_INVALID_STATUS: 'This action is not allowed for the current PR status.',
  PR_VALIDATION_FAILED: 'Please correct the highlighted fields and try again.',
  PR_NOT_EDITABLE: 'Submitted PR cannot be edited.',
  PR_MUST_REOPEN: 'Approved PR must be reopened before amendment.',
  PR_NOT_SUBMITTABLE: 'Purchase requisition cannot be submitted in its current state.',
  PR_NOT_APPROVABLE: 'Purchase requisition cannot be approved or rejected in its current state.',
  PR_RFQ_FLAG_LOCKED: 'RFQ Required cannot be changed in the current status.',
  PR_NOT_APPROVED: 'Only approved purchase requisitions can be used for this action.',
  PR_RFQ_REQUIRED: 'This requisition requires the RFQ path. Use RFQ, not Planning or direct PO.',
  RFQ_REQUIRED: 'This requisition requires an RFQ before a Purchase Order can be created.',
  PR_DIRECT_PO_PATH: 'This requisition uses the Planning path. RFQ is not allowed.',
  PR_DEPARTMENT_REQUIRED: 'Department is required.',
  PR_REQUESTED_BY_REQUIRED: 'Requested By is required.',
  PR_REQUISITION_DATE_REQUIRED: 'Requisition date is required.',
  PR_REQUIRED_DATE_REQUIRED: 'Required date is required.',
  PR_RFQ_REQUIRED_SELECTION: 'RFQ Required selection is mandatory.',
  PR_NO_LINES: 'Add at least one item.',
  PR_ITEM_REQUIRED: 'Item is required.',
  PR_QTY_INVALID: 'Quantity must be greater than zero.',
  PR_UOM_REQUIRED: 'UOM is required.',
  PR_REQUIRED_DATE_BEFORE_REQUISITION: 'Required date cannot be before requisition date.',
  PR_REJECTION_REASON_REQUIRED: 'Rejection reason is required.',
  PR_SEND_BACK_REASON_REQUIRED: 'Send-back reason is required.',
  APPROVAL_SELF_ACTION_NOT_ALLOWED: 'You cannot approve a document that you requested or created.',
  APPROVAL_DELEGATE_INVALID: 'Select another active user who can approve this document.',
  APPROVAL_ASSIGNED_TO_ANOTHER_USER: 'This approval is assigned to another user.',

  PPS_NOT_FOUND: 'Planning sheet row not found.',
  PPS_DUPLICATE_LINE: 'Planning row already exists for this requisition line.',
  PPS_NOT_ELIGIBLE: 'Selected rows must have eligible statuses.',
  PPS_NO_SELECTION: 'Select at least one eligible Planning row.',
  PPS_READ_ONLY: 'PO-created rows cannot be edited or converted again.',
  PPS_PO_NOT_READY:
    'Selected vendor, rate, net quantity, and required date are needed before PO creation.',
  PPS_INVALID_TRANSITION: 'Invalid planning status transition.',
  PPS_STATUS_REASON_REQUIRED: 'Reason is required for this status change.',
  PPS_VENDOR_REQUIRED: 'Selected vendor is required before PO creation.',
  PPS_NET_QTY_INVALID: 'Net Purchase Quantity must be greater than zero.',
  PPS_RATE_REQUIRED: 'Rate is required before PO creation.',
  PPS_REQUIRED_DATE_REQUIRED: 'Required date is required.',
  PPS_ALREADY_CONVERTED: 'PO-created rows cannot be edited or converted again.',
  PPS_CANCELLED: 'Cancelled rows cannot be converted.',
  PPS_RFQ_REQUIRED: 'RFQ-required PR items cannot be processed from Planning.',
  PPS_NOT_SELECTED: 'Select at least one planning row that is ready for PO (vendor, quantity, rate, date).',

  PO_NO_ELIGIBLE_ROWS: 'Select at least one eligible Planning row.',
  PO_TENANT_MISMATCH: 'All rows must belong to the current tenant.',
  PO_VENDOR_INACTIVE: 'Vendor must be active.',
  PO_ITEM_INACTIVE: 'Item must be active.',
  PO_UOM_INACTIVE: 'UOM must be active.',
  PO_COMMERCIAL_TERMS_REQUIRED: 'Required commercial terms must be present.',
  PO_ALREADY_CONVERTED: 'Converted rows must not be selected again.',
  PO_CREATE_FAILED: 'Purchase order could not be created. Please try again.',
  PO_NOT_FOUND: 'Purchase order not found.',
  PO_INVALID_STATUS: 'This action is not allowed for the current PO status.',

  TENANT_MISMATCH: 'Tenant access denied.',
  FORBIDDEN: 'You do not have permission for this action.',
  PERMISSION_DENIED: 'You do not have permission for this action.',
  VALIDATION_ERROR: 'Please correct the highlighted fields and try again.',
  PURCHASE_RETURN_NOT_FOUND: 'Purchase return not found.',
  PURCHASE_RETURN_INVALID_STATE: 'This action is not allowed for the current return status.',
  SERVER_TYPE_ERROR: 'Server configuration error while saving. Please retry or contact support.',

  // Legacy aliases
  PURCHASE_REQUISITION_NOT_FOUND: 'Purchase requisition not found.',
  PURCHASE_REQUISITION_NOT_EDITABLE: 'Submitted PR cannot be edited.',
  PURCHASE_REQUISITION_NOT_SUBMITTABLE:
    'Purchase requisition cannot be submitted in its current state.',
  PURCHASE_REQUISITION_NOT_APPROVABLE:
    'Purchase requisition cannot be approved or rejected in its current state.',
  REJECTION_REASON_REQUIRED: 'Rejection reason is required.',
  INVALID_PURCHASE_QUANTITY: 'Quantity must be greater than zero.',
  REMARKS_REQUIRED: 'Rejection reason is required.',
}

const TECHNICAL_NOISE =
  /prisma|foreign.?key|constraint|sql\s|stack trace|at\s+\S+\s+\(|ECONNREFUSED|ENOTFOUND|P20\d{2}|undefined is not|cannot read propert|bad request|^undefined$|^null$/i

export function isTechnicalPurchaseMessage(message: string | undefined | null): boolean {
  if (!message?.trim()) return true
  return TECHNICAL_NOISE.test(message.trim())
}

export function mapPurchaseErrorMessage(code?: string, fallback?: string): string {
  if (code && PURCHASE_ERROR_MESSAGES[code]) {
    return PURCHASE_ERROR_MESSAGES[code]
  }
  if (fallback && !isTechnicalPurchaseMessage(fallback)) {
    return fallback.trim()
  }
  if (code) {
    return code.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) + '.'
  }
  return 'Something went wrong. Please try again.'
}

/** Prefer for toast / notify from catch blocks. */
export function purchaseUserMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err && typeof err === 'object') {
    const code = 'code' in err ? String((err as { code?: string }).code ?? '') : ''
    const message = 'message' in err ? String((err as { message?: string }).message ?? '') : ''
    if (code || message) return mapPurchaseErrorMessage(code || undefined, message || fallback)
  }
  if (err instanceof Error) return mapPurchaseErrorMessage(undefined, err.message)
  return fallback
}
