import type { Request } from 'express'
import type { CustomerReceiptStatus } from './customer-receipt.types.js'

export interface CustomerReceiptAllowedActions {
  edit: boolean
  validate: boolean
  markReady: boolean
  cancel: boolean
  /** Always false in Phase 3B3 — posting ships in Phase 3B4. */
  post: boolean
  /** Always false in Phase 3B3 — allocation persistence ships alongside posting. */
  allocate: boolean
  viewAccounting?: boolean
  viewCreditOpenItem?: boolean
}

const EDITABLE_STATUSES: CustomerReceiptStatus[] = ['DRAFT', 'READY_TO_POST']
const CANCELLABLE_STATUSES: CustomerReceiptStatus[] = ['DRAFT', 'READY_TO_POST']

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function resolveCustomerReceiptAllowedActions(
  req: Request,
  status: CustomerReceiptStatus,
): CustomerReceiptAllowedActions {
  const canView = hasPerm(req, 'finance.ar.receipt.view')
  const editable = EDITABLE_STATUSES.includes(status)
  const cancellable = CANCELLABLE_STATUSES.includes(status)

  if (status === 'POSTED' || status === 'CANCELLED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      allocate: false,
      viewAccounting: canView,
      viewCreditOpenItem: canView,
    }
  }

  return {
    edit: editable && hasPerm(req, 'finance.ar.receipt.edit'),
    validate: canView,
    markReady: status === 'DRAFT' && hasPerm(req, 'finance.ar.receipt.edit'),
    cancel: cancellable && hasPerm(req, 'finance.ar.receipt.cancel'),
    post: false,
    allocate: false,
    viewAccounting: false,
    viewCreditOpenItem: false,
  }
}
