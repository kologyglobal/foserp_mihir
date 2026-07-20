/**
 * Stable purchase API error codes + default user-facing messages.
 * Keep in sync with `frontend/src/utils/purchase/purchaseErrorMessages.ts`.
 */

export const PURCHASE_ERROR_CODE = {
  // PR
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  PR_INVALID_STATUS: 'PR_INVALID_STATUS',
  PR_VALIDATION_FAILED: 'PR_VALIDATION_FAILED',
  PR_NOT_EDITABLE: 'PR_NOT_EDITABLE',
  PR_MUST_REOPEN: 'PR_MUST_REOPEN',
  PR_NOT_SUBMITTABLE: 'PR_NOT_SUBMITTABLE',
  PR_NOT_APPROVABLE: 'PR_NOT_APPROVABLE',
  PR_RFQ_FLAG_LOCKED: 'PR_RFQ_FLAG_LOCKED',
  PR_NOT_APPROVED: 'PR_NOT_APPROVED',
  PR_RFQ_REQUIRED: 'PR_RFQ_REQUIRED',
  PR_DIRECT_PO_PATH: 'PR_DIRECT_PO_PATH',
  PR_DEPARTMENT_REQUIRED: 'PR_DEPARTMENT_REQUIRED',
  PR_REQUESTED_BY_REQUIRED: 'PR_REQUESTED_BY_REQUIRED',
  PR_REQUISITION_DATE_REQUIRED: 'PR_REQUISITION_DATE_REQUIRED',
  PR_REQUIRED_DATE_REQUIRED: 'PR_REQUIRED_DATE_REQUIRED',
  PR_RFQ_REQUIRED_SELECTION: 'PR_RFQ_REQUIRED_SELECTION',
  PR_NO_LINES: 'PR_NO_LINES',
  PR_ITEM_REQUIRED: 'PR_ITEM_REQUIRED',
  PR_QTY_INVALID: 'PR_QTY_INVALID',
  PR_UOM_REQUIRED: 'PR_UOM_REQUIRED',
  PR_REQUIRED_DATE_BEFORE_REQUISITION: 'PR_REQUIRED_DATE_BEFORE_REQUISITION',
  PR_REJECTION_REASON_REQUIRED: 'PR_REJECTION_REASON_REQUIRED',

  // Planning
  PPS_NOT_FOUND: 'PPS_NOT_FOUND',
  PPS_DUPLICATE_LINE: 'PPS_DUPLICATE_LINE',
  PPS_NOT_ELIGIBLE: 'PPS_NOT_ELIGIBLE',
  PPS_NO_SELECTION: 'PPS_NO_SELECTION',
  PPS_READ_ONLY: 'PPS_READ_ONLY',
  PPS_PO_NOT_READY: 'PPS_PO_NOT_READY',
  PPS_INVALID_TRANSITION: 'PPS_INVALID_TRANSITION',
  PPS_STATUS_REASON_REQUIRED: 'PPS_STATUS_REASON_REQUIRED',
  PPS_VENDOR_REQUIRED: 'PPS_VENDOR_REQUIRED',
  PPS_NET_QTY_INVALID: 'PPS_NET_QTY_INVALID',
  PPS_RATE_REQUIRED: 'PPS_RATE_REQUIRED',
  PPS_REQUIRED_DATE_REQUIRED: 'PPS_REQUIRED_DATE_REQUIRED',
  PPS_ALREADY_CONVERTED: 'PPS_ALREADY_CONVERTED',
  PPS_CANCELLED: 'PPS_CANCELLED',
  PPS_RFQ_REQUIRED: 'PPS_RFQ_REQUIRED',

  // PO creation
  PO_NO_ELIGIBLE_ROWS: 'PO_NO_ELIGIBLE_ROWS',
  PO_TENANT_MISMATCH: 'PO_TENANT_MISMATCH',
  PO_VENDOR_INACTIVE: 'PO_VENDOR_INACTIVE',
  PO_ITEM_INACTIVE: 'PO_ITEM_INACTIVE',
  PO_UOM_INACTIVE: 'PO_UOM_INACTIVE',
  PO_COMMERCIAL_TERMS_REQUIRED: 'PO_COMMERCIAL_TERMS_REQUIRED',
  PO_ALREADY_CONVERTED: 'PO_ALREADY_CONVERTED',
  PO_CREATE_FAILED: 'PO_CREATE_FAILED',
  PO_NOT_FOUND: 'PO_NOT_FOUND',
  PO_INVALID_STATUS: 'PO_INVALID_STATUS',

  // Shared
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  FORBIDDEN: 'FORBIDDEN',
} as const

export type PurchaseErrorCode = (typeof PURCHASE_ERROR_CODE)[keyof typeof PURCHASE_ERROR_CODE]

/** Default business messages — never include Prisma/SQL/stack details. */
export const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  [PURCHASE_ERROR_CODE.PR_NOT_FOUND]: 'Purchase requisition not found.',
  [PURCHASE_ERROR_CODE.PR_INVALID_STATUS]: 'This action is not allowed for the current PR status.',
  [PURCHASE_ERROR_CODE.PR_VALIDATION_FAILED]: 'Please correct the highlighted fields and try again.',
  [PURCHASE_ERROR_CODE.PR_NOT_EDITABLE]: 'Submitted PR cannot be edited.',
  [PURCHASE_ERROR_CODE.PR_MUST_REOPEN]: 'Approved PR must be reopened before amendment.',
  [PURCHASE_ERROR_CODE.PR_NOT_SUBMITTABLE]: 'Purchase requisition cannot be submitted in its current state.',
  [PURCHASE_ERROR_CODE.PR_NOT_APPROVABLE]: 'Purchase requisition cannot be approved or rejected in its current state.',
  [PURCHASE_ERROR_CODE.PR_RFQ_FLAG_LOCKED]: 'RFQ Required cannot be changed in the current status.',
  [PURCHASE_ERROR_CODE.PR_NOT_APPROVED]: 'Only approved purchase requisitions can be used for this action.',
  [PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED]: 'This requisition requires the RFQ path. Use RFQ, not Planning or direct PO.',
  [PURCHASE_ERROR_CODE.PR_DIRECT_PO_PATH]: 'This requisition uses the Planning path. RFQ is not allowed.',
  [PURCHASE_ERROR_CODE.PR_DEPARTMENT_REQUIRED]: 'Department is required.',
  [PURCHASE_ERROR_CODE.PR_REQUESTED_BY_REQUIRED]: 'Requested By is required.',
  [PURCHASE_ERROR_CODE.PR_REQUISITION_DATE_REQUIRED]: 'Requisition date is required.',
  [PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_REQUIRED]: 'Required date is required.',
  [PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED_SELECTION]: 'RFQ Required selection is mandatory.',
  [PURCHASE_ERROR_CODE.PR_NO_LINES]: 'Add at least one item.',
  [PURCHASE_ERROR_CODE.PR_ITEM_REQUIRED]: 'Item is required.',
  [PURCHASE_ERROR_CODE.PR_QTY_INVALID]: 'Quantity must be greater than zero.',
  [PURCHASE_ERROR_CODE.PR_UOM_REQUIRED]: 'UOM is required.',
  [PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_BEFORE_REQUISITION]:
    'Required date cannot be before requisition date.',
  [PURCHASE_ERROR_CODE.PR_REJECTION_REASON_REQUIRED]: 'Rejection reason is required.',

  [PURCHASE_ERROR_CODE.PPS_NOT_FOUND]: 'Planning sheet row not found.',
  [PURCHASE_ERROR_CODE.PPS_DUPLICATE_LINE]: 'Planning row already exists for this requisition line.',
  [PURCHASE_ERROR_CODE.PPS_NOT_ELIGIBLE]: 'Selected rows must have eligible statuses.',
  [PURCHASE_ERROR_CODE.PPS_NO_SELECTION]: 'Select at least one eligible Planning row.',
  [PURCHASE_ERROR_CODE.PPS_READ_ONLY]: 'PO-created rows cannot be edited or converted again.',
  [PURCHASE_ERROR_CODE.PPS_PO_NOT_READY]: 'Selected vendor, rate, net quantity, and required date are needed before PO creation.',
  [PURCHASE_ERROR_CODE.PPS_INVALID_TRANSITION]: 'Invalid planning status transition.',
  [PURCHASE_ERROR_CODE.PPS_STATUS_REASON_REQUIRED]: 'Reason is required for this status change.',
  [PURCHASE_ERROR_CODE.PPS_VENDOR_REQUIRED]: 'Selected vendor is required before PO creation.',
  [PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID]: 'Net Purchase Quantity must be greater than zero.',
  [PURCHASE_ERROR_CODE.PPS_RATE_REQUIRED]: 'Rate is required before PO creation.',
  [PURCHASE_ERROR_CODE.PPS_REQUIRED_DATE_REQUIRED]: 'Required date is required.',
  [PURCHASE_ERROR_CODE.PPS_ALREADY_CONVERTED]: 'PO-created rows cannot be edited or converted again.',
  [PURCHASE_ERROR_CODE.PPS_CANCELLED]: 'Cancelled rows cannot be converted.',
  [PURCHASE_ERROR_CODE.PPS_RFQ_REQUIRED]: 'RFQ-required PR items cannot be processed from Planning.',

  [PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS]: 'Select at least one eligible Planning row.',
  [PURCHASE_ERROR_CODE.PO_TENANT_MISMATCH]: 'All rows must belong to the current tenant.',
  [PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE]: 'Vendor must be active.',
  [PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE]: 'Item must be active.',
  [PURCHASE_ERROR_CODE.PO_UOM_INACTIVE]: 'UOM must be active.',
  [PURCHASE_ERROR_CODE.PO_COMMERCIAL_TERMS_REQUIRED]: 'Required commercial terms must be present.',
  [PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED]: 'Converted rows must not be selected again.',
  [PURCHASE_ERROR_CODE.PO_CREATE_FAILED]: 'Purchase order could not be created. Please try again.',
  [PURCHASE_ERROR_CODE.PO_NOT_FOUND]: 'Purchase order not found.',
  [PURCHASE_ERROR_CODE.PO_INVALID_STATUS]: 'This action is not allowed for the current PO status.',

  [PURCHASE_ERROR_CODE.TENANT_MISMATCH]: 'Tenant access denied.',
  [PURCHASE_ERROR_CODE.FORBIDDEN]: 'You do not have permission for this action.',

  // Legacy aliases (older API codes)
  PURCHASE_REQUISITION_NOT_FOUND: 'Purchase requisition not found.',
  PURCHASE_REQUISITION_NOT_EDITABLE: 'Submitted PR cannot be edited.',
  PURCHASE_REQUISITION_NOT_SUBMITTABLE: 'Purchase requisition cannot be submitted in its current state.',
  PURCHASE_REQUISITION_NOT_APPROVABLE:
    'Purchase requisition cannot be approved or rejected in its current state.',
  REJECTION_REASON_REQUIRED: 'Rejection reason is required.',
  INVALID_PURCHASE_QUANTITY: 'Quantity must be greater than zero.',
}

export function purchaseMessage(code: string, override?: string): string {
  if (override?.trim()) return override.trim()
  return PURCHASE_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.'
}
