import type { Request } from 'express'
import type { FixedAssetDisposalStatus } from '@prisma/client'
import type { FixedAssetDisposalAllowedActions } from './fixed-asset-disposal.types.js'

function can(req: Request, permission: string): boolean {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

const OPEN_STATUSES: FixedAssetDisposalStatus[] = ['DRAFT', 'REJECTED', 'READY_TO_POST', 'PENDING_APPROVAL']

/** Server-authoritative allowed actions for FA2 disposal documents. */
export function resolveFixedAssetDisposalAllowedActions(
  req: Request,
  status: FixedAssetDisposalStatus,
  approvalRequired: boolean,
  hasActiveReconciliationMatch: boolean,
): FixedAssetDisposalAllowedActions {
  const view = can(req, 'finance.fa.view')

  return {
    view,
    edit: ['DRAFT', 'REJECTED'].includes(status) && can(req, 'finance.fa.dispose'),
    validate: OPEN_STATUSES.includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.fa.dispose'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.fa.dispose'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.fa.dispose.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.fa.dispose.approve'),
    revise: ['REJECTED', 'READY_TO_POST'].includes(status) && can(req, 'finance.fa.dispose'),
    cancel: OPEN_STATUSES.includes(status) && can(req, 'finance.fa.dispose'),
    post: status === 'READY_TO_POST' && can(req, 'finance.fa.dispose'),
    reverse: status === 'POSTED' && !hasActiveReconciliationMatch && can(req, 'finance.fa.dispose.reverse'),
  }
}
