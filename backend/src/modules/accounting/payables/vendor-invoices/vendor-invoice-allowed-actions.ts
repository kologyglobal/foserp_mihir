import type { Request } from 'express'
import type { VendorInvoiceStatus } from '@prisma/client'

function can(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

/**
 * Server-authoritative allowed actions for vendor invoices (Phase 4A3 + 4A4).
 * Payment/allocation remain false until Phase 4B.
 */
export function resolveVendorInvoiceAllowedActions(
  req: Request,
  status: VendorInvoiceStatus,
  approvalRequired: boolean,
) {
  const view = can(req, 'finance.ap.vendor_invoice.view')
  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.ap.vendor_invoice.edit'),
    validate:
      ['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.ap.vendor_invoice.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.ap.vendor_invoice.mark_ready'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.vendor_invoice.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.ap.vendor_invoice.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.ap.vendor_invoice.edit'),
    cancel:
      ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(status) &&
      can(req, 'finance.ap.vendor_invoice.cancel'),
    post: status === 'READY_TO_POST' && can(req, 'finance.ap.vendor_invoice.post'),
    reverse: status === 'POSTED' && can(req, 'finance.ap.vendor_invoice.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: status === 'POSTED' && view,
    viewPayableOpenItem: status === 'POSTED' && view,
    pay: false,
    allocate: false,
  }
}
