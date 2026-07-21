import type { Request } from 'express'
import type { VendorAdjustmentStatus, VendorAdjustmentType } from '@prisma/client'

function can(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

export interface VendorAdjustmentAllocationSourceState {
  status: string
  outstandingAmount: string | number
  isOnHold?: boolean
  isDisputed?: boolean
}

/**
 * Server-authoritative allowed actions for vendor adjustments (Phase 4C2).
 * `allocate` is enabled only for posted vendor debit notes with an allocatable DEBIT open item.
 */
export function resolveVendorAdjustmentAllowedActions(
  req: Request,
  status: VendorAdjustmentStatus,
  approvalRequired: boolean,
  adjustmentType?: VendorAdjustmentType,
  source?: VendorAdjustmentAllocationSourceState | null,
) {
  const view = can(req, 'finance.ap.adjustment.view')
  const sourceAllocatable =
    !!source &&
    (source.status === 'OPEN' || source.status === 'PARTIALLY_SETTLED') &&
    Number(source.outstandingAmount) > 0 &&
    !source.isOnHold &&
    !source.isDisputed
  const isDebitNote = adjustmentType === 'VENDOR_DEBIT_NOTE'
  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.ap.adjustment.edit'),
    validate:
      ['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.ap.adjustment.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.ap.adjustment.mark_ready'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.adjustment.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.adjustment.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.ap.adjustment.edit'),
    cancel:
      ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(status) &&
      can(req, 'finance.ap.adjustment.cancel'),
    post: status === 'READY_TO_POST' && can(req, 'finance.ap.adjustment.post'),
    reverse: status === 'POSTED' && can(req, 'finance.ap.adjustment.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: status === 'POSTED' && view,
    viewPayableOpenItem: status === 'POSTED' && view,
    viewOpenItem: status === 'POSTED' && view,
    pay: false,
    allocate:
      status === 'POSTED' &&
      isDebitNote &&
      can(req, 'finance.ap.allocation.create') &&
      sourceAllocatable,
  }
}
