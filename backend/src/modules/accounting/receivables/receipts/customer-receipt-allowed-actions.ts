import type { Request } from 'express'
import type { CustomerReceiptStatus } from './customer-receipt.types.js'

export interface CustomerReceiptAllowedActions {
  edit: boolean
  validate: boolean
  markReady: boolean
  cancel: boolean
  post: boolean
  allocate: boolean
  viewAllocations?: boolean
  viewAccounting?: boolean
  viewCreditOpenItem?: boolean
  /** Always false — receipt reversal is deferred beyond Phase 3B5. */
  reverse?: boolean
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
  options?: { creditOutstanding?: string | number | null },
): CustomerReceiptAllowedActions {
  const canView = hasPerm(req, 'finance.ar.receipt.view')
  const canViewAlloc = hasPerm(req, 'finance.ar.allocation.view')
  const canAllocate = hasPerm(req, 'finance.ar.allocation.create')
  const editable = EDITABLE_STATUSES.includes(status)
  const cancellable = CANCELLABLE_STATUSES.includes(status)
  const canPost = status === 'READY_TO_POST' && hasPerm(req, 'finance.ar.receipt.post')
  const creditOutstanding = Number(options?.creditOutstanding ?? 0)
  const hasCredit = Number.isFinite(creditOutstanding) && creditOutstanding > 0

  if (status === 'POSTED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      allocate: canAllocate && hasCredit,
      viewAllocations: canViewAlloc,
      viewAccounting: canView,
      viewCreditOpenItem: canView,
      reverse: false,
    }
  }

  if (status === 'CANCELLED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      allocate: false,
      viewAllocations: canViewAlloc,
      viewAccounting: canView,
      viewCreditOpenItem: canView,
      reverse: false,
    }
  }

  return {
    edit: editable && hasPerm(req, 'finance.ar.receipt.edit'),
    validate: canView,
    markReady: status === 'DRAFT' && hasPerm(req, 'finance.ar.receipt.edit'),
    cancel: cancellable && hasPerm(req, 'finance.ar.receipt.cancel'),
    post: canPost,
    allocate: false,
    viewAllocations: false,
    viewAccounting: false,
    viewCreditOpenItem: false,
    reverse: false,
  }
}
