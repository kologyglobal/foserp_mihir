import type { Request } from 'express'
import type { VendorPaymentStatus } from '@prisma/client'

function can(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

export interface VendorPaymentAllocationSourceState {
  status: string
  outstandingAmount: string | number
  isOnHold?: boolean
  isDisputed?: boolean
}

/**
 * Server-authoritative allowed actions for vendor payments (Phase 4B4).
 * `allocate` is enabled for POSTED payments whose DEBIT source open item is still allocatable.
 * Payment reversal remains false — deferred.
 */
export function resolveVendorPaymentAllowedActions(
  req: Request,
  status: VendorPaymentStatus,
  approvalRequired: boolean,
  source?: VendorPaymentAllocationSourceState | null,
) {
  const view = can(req, 'finance.ap.payment.view')
  const sourceAllocatable =
    !!source &&
    (source.status === 'OPEN' || source.status === 'PARTIALLY_SETTLED') &&
    Number(source.outstandingAmount) > 0 &&
    !source.isOnHold &&
    !source.isDisputed
  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.ap.payment.edit'),
    validate:
      ['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.ap.payment.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.ap.payment.mark_ready'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.payment.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.payment.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.ap.payment.edit'),
    cancel:
      ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(status) &&
      can(req, 'finance.ap.payment.cancel'),
    post: status === 'READY_TO_POST' && can(req, 'finance.ap.payment.post'),
    reverse: status === 'POSTED' && can(req, 'finance.ap.payment.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: status === 'POSTED' && view,
    viewPayableOpenItem: status === 'POSTED' && view,
    allocate: status === 'POSTED' && can(req, 'finance.ap.allocation.create') && sourceAllocatable,
  }
}
