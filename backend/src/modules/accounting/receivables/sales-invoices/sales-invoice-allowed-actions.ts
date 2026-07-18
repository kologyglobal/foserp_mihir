import type { Request } from 'express'
import type { SalesInvoiceStatus } from './sales-invoice.types.js'

export interface SalesInvoiceAllowedActions {
  edit: boolean
  validate: boolean
  markReady: boolean
  cancel: boolean
  post: boolean
  viewAccounting?: boolean
  viewAllocations?: boolean
}

const EDITABLE_STATUSES: SalesInvoiceStatus[] = ['DRAFT', 'READY_TO_POST']
const CANCELLABLE_STATUSES: SalesInvoiceStatus[] = ['DRAFT', 'READY_TO_POST']

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function resolveSalesInvoiceAllowedActions(
  req: Request,
  status: SalesInvoiceStatus,
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
    viewAllocations: false,
  }
}
