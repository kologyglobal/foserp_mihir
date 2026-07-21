import type { Request } from 'express'
import type { TreasuryTransferPostingMode, TreasuryTransferStatus } from '@prisma/client'

function can(req: Request, permission: string): boolean {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

/** Server-authoritative allowed actions for treasury transfers (Phase 5B1). */
export function resolveTreasuryTransferAllowedActions(
  req: Request,
  status: TreasuryTransferStatus,
  approvalRequired: boolean,
  postingMode: TreasuryTransferPostingMode,
) {
  const view = can(req, 'finance.treasury.transfer.view')
  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.treasury.transfer.edit'),
    validate: ['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.treasury.transfer.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.treasury.transfer.edit'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.transfer.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.transfer.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.treasury.transfer.edit'),
    cancel:
      ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL'].includes(status) &&
      can(req, 'finance.treasury.transfer.cancel'),
    post: status === 'READY_TO_POST' && postingMode === 'DIRECT' && can(req, 'finance.treasury.transfer.post'),
    dispatch: status === 'READY_TO_POST' && postingMode === 'IN_TRANSIT' && can(req, 'finance.treasury.transfer.dispatch'),
    receive: status === 'IN_TRANSIT' && can(req, 'finance.treasury.transfer.receive'),
    reverse: status === 'COMPLETED' && can(req, 'finance.treasury.transfer.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: (status === 'COMPLETED' || status === 'IN_TRANSIT') && view,
  }
}
