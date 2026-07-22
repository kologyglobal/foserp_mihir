import type { Request } from 'express'
import type { BankReconciliationMatchStatus, BankReconciliationSessionStatus } from '@prisma/client'
import type { MatchAllowedActions, SessionAllowedActions } from './bank-reconciliation.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function buildSessionAllowedActions(req: Request, status: BankReconciliationSessionStatus): SessionAllowedActions {
  const isOpenLike = status === 'OPEN' || status === 'IN_PROGRESS' || status === 'READY_TO_FINALIZE'
  const isFinalized = status === 'FINALIZED'

  return {
    runAutoMatch: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.run_auto_match'),
    match: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.match'),
    groupMatch: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.group_match'),
    partialMatch: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.partial_match'),
    unmatch: hasPerm(req, 'finance.bank.reconciliation.unmatch'),
    finalize: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.finalize'),
    finalizeWithExceptions: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.finalize_with_exceptions'),
    reopen: isFinalized && hasPerm(req, 'finance.bank.reconciliation.reopen'),
    manageExceptions: hasPerm(req, 'finance.bank.reconciliation.exception_manage'),
    createAdjustmentDraft: isOpenLike && hasPerm(req, 'finance.bank.reconciliation.adjustment_draft_create'),
  }
}

export function buildMatchAllowedActions(req: Request, matchStatus: BankReconciliationMatchStatus): MatchAllowedActions {
  return {
    unmatch: matchStatus === 'ACTIVE' && hasPerm(req, 'finance.bank.reconciliation.unmatch'),
    view: hasPerm(req, 'finance.bank.reconciliation.view'),
  }
}
