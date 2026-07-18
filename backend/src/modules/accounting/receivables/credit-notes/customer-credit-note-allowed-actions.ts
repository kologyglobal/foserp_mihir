import type { Request } from 'express'
import type { CustomerCreditNoteStatus } from '@prisma/client'

function can(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

export function resolveCustomerCreditNoteAllowedActions(
  req: Request,
  status: CustomerCreditNoteStatus,
  approvalRequired: boolean,
  options?: { unallocatedAmount?: string | number | null },
) {
  const unallocated = Number(options?.unallocatedAmount ?? 0)
  const hasUnallocated = Number.isFinite(unallocated) && unallocated > 0
  return {
    edit: ['DRAFT', 'READY_TO_POST', 'REJECTED'].includes(status) && can(req, 'finance.ar.credit_note.edit'),
    validate: ['DRAFT', 'READY_TO_POST'].includes(status) && can(req, 'finance.ar.credit_note.view'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.ar.credit_note.mark_ready'),
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.ar.credit_note.submit'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.ar.credit_note.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.ar.credit_note.approve'),
    cancel: ['DRAFT', 'READY_TO_POST', 'REJECTED'].includes(status) && can(req, 'finance.ar.credit_note.cancel'),
    post: status === 'READY_TO_POST' && can(req, 'finance.ar.credit_note.post'),
    viewAccounting: status === 'POSTED' && can(req, 'finance.voucher.view'),
    /// Phase 3C5 — allocation of posted credit note credit to invoice debit open items.
    allocate: status === 'POSTED' && hasUnallocated && can(req, 'finance.ar.allocation.create'),
    viewAllocations: status === 'POSTED' && can(req, 'finance.ar.allocation.view'),
    reverse: false,
  }
}
