import type { Request } from 'express'
import type { SalesInvoiceAllowedActions, SalesInvoiceStatus } from './sales-invoice.types.js'

export type { SalesInvoiceAllowedActions } from './sales-invoice.types.js'

const EDITABLE_STATUSES: SalesInvoiceStatus[] = ['DRAFT', 'READY_TO_POST']
const CANCELLABLE_STATUSES: SalesInvoiceStatus[] = ['DRAFT', 'READY_TO_POST']

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function resolveSalesInvoiceAllowedActions(
  req: Request,
  status: SalesInvoiceStatus,
  options?: { hasPostedAllocations?: boolean },
): SalesInvoiceAllowedActions {
  const canView = hasPerm(req, 'finance.ar.invoice.view') || hasPerm(req, 'finance.ar.view')
  const canViewAlloc = hasPerm(req, 'finance.ar.allocation.view')
  const editable = EDITABLE_STATUSES.includes(status)
  const cancellable = CANCELLABLE_STATUSES.includes(status)
  const canPost = status === 'READY_TO_POST' && hasPerm(req, 'finance.ar.invoice.post')

  if (status === 'POSTED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      reverse: hasPerm(req, 'finance.ar.invoice.reverse') && options?.hasPostedAllocations !== true,
      viewAccounting: canView,
      viewAllocations: canViewAlloc,
    }
  }

  if (status === 'REVERSED') {
    return {
      edit: false,
      validate: false,
      markReady: false,
      cancel: false,
      post: false,
      reverse: false,
      viewAccounting: canView,
      viewAllocations: canViewAlloc,
    }
  }

  return {
    edit: editable && hasPerm(req, 'finance.ar.invoice.edit'),
    validate: canView,
    markReady: status === 'DRAFT' && hasPerm(req, 'finance.ar.invoice.edit'),
    cancel: cancellable && hasPerm(req, 'finance.ar.invoice.cancel'),
    post: canPost,
    reverse: false,
    viewAllocations: false,
  }
}
