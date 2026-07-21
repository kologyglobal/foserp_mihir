import type { Request } from 'express'
import type { TreasuryAdjustmentStatus } from '@prisma/client'

function can(req: Request, permission: string): boolean {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

/** Server-authoritative allowed actions for treasury adjustments (Phase 5B3). */
export function resolveTreasuryAdjustmentAllowedActions(
  req: Request,
  status: TreasuryAdjustmentStatus,
  approvalRequired: boolean,
  hasActiveReconciliationMatch: boolean,
) {
  const view = can(req, 'finance.treasury.adjustment.view')
  const openStatuses: TreasuryAdjustmentStatus[] = ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL']

  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.treasury.adjustment.edit'),
    validate: openStatuses.includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.treasury.adjustment.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.treasury.adjustment.edit'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.adjustment.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.adjustment.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.treasury.adjustment.edit'),
    cancel: openStatuses.includes(status) && can(req, 'finance.treasury.adjustment.cancel'),
    post: status === 'READY_TO_POST' && can(req, 'finance.treasury.adjustment.post'),
    reverse: status === 'POSTED' && !hasActiveReconciliationMatch && can(req, 'finance.treasury.adjustment.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: status === 'POSTED' || status === 'REVERSED',
  }
}
