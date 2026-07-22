import type { Request } from 'express'
import type { TreasuryChequeDirection, TreasuryChequeStatus } from '@prisma/client'
import { isTrackOnlyCheque } from './treasury-cheque-draft.service.js'

function can(req: Request, permission: string): boolean {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

/** Server-authoritative allowed actions for treasury cheques (Phase 5B2). */
export function resolveTreasuryChequeAllowedActions(
  req: Request,
  status: TreasuryChequeStatus,
  direction: TreasuryChequeDirection,
  approvalRequired: boolean,
  accountingMode: string,
  customerReceiptId?: string | null,
  vendorPaymentId?: string | null,
) {
  const view = can(req, 'finance.treasury.cheque.view')
  const isTrackOnly = isTrackOnlyCheque({ accountingMode, direction, customerReceiptId, vendorPaymentId })
  const openStatuses: TreasuryChequeStatus[] = ['DRAFT', 'REJECTED', 'READY', 'PENDING_APPROVAL']
  const postedStatuses: TreasuryChequeStatus[] = ['ISSUED', 'DEPOSITED']

  return {
    view,
    edit: status === 'DRAFT' && can(req, 'finance.treasury.cheque.edit'),
    validate: openStatuses.includes(status) && view,
    submit: status === 'DRAFT' && approvalRequired && can(req, 'finance.treasury.cheque.submit'),
    markReady: status === 'DRAFT' && !approvalRequired && can(req, 'finance.treasury.cheque.edit'),
    approve: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.cheque.approve'),
    reject: status === 'PENDING_APPROVAL' && can(req, 'finance.treasury.cheque.approve'),
    revise: ['REJECTED', 'READY'].includes(status) && can(req, 'finance.treasury.cheque.edit'),
    cancel: openStatuses.includes(status) && can(req, 'finance.treasury.cheque.cancel'),
    issue: status === 'READY' && direction === 'ISSUED' && can(req, 'finance.treasury.cheque.issue'),
    deposit: status === 'READY' && direction === 'RECEIVED' && can(req, 'finance.treasury.cheque.deposit'),
    clear: postedStatuses.includes(status) && can(req, 'finance.treasury.cheque.clear'),
    bounce: postedStatuses.includes(status) && can(req, 'finance.treasury.cheque.bounce'),
    stop: direction === 'ISSUED' && ['DRAFT', 'READY', 'ISSUED'].includes(status) && can(req, 'finance.treasury.cheque.stop'),
    reverse: ['ISSUED', 'DEPOSITED', 'CLEARED'].includes(status) && !isTrackOnly && can(req, 'finance.treasury.cheque.reverse'),
    viewApproval: status !== 'DRAFT' && view,
    viewAccountingPreview: view,
    viewAccounting: [...postedStatuses, 'CLEARED', 'BOUNCED', 'STOPPED', 'REVERSED'].includes(status) && view && !isTrackOnly,
  }
}
