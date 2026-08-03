import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as loans from './loan.service.js'
import type {
  ApproveLoanInput,
  CancelLoanInput,
  CreateLoanInput,
  DisburseLoanInput,
  EarlyRepaymentInput,
  ListLoansQuery,
  ListMyLoansQuery,
  LoanAccountingQuery,
  PartialRecoverInput,
  RejectLoanInput,
  SkipInstallmentInput,
  UpdateLoanDraftInput,
} from './loan.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

function hasPerm(req: Request, name: string): boolean {
  return Boolean(req.context?.permissions?.includes(name))
}

export const listLoans = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await loans.listLoans(getTenantId(req), scope, req.query as unknown as ListLoansQuery)
  return sendPaginated(res, 'Loans listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const result = await loans.listMine(getTenantId(req), req.context!.userId, req.query as unknown as ListMyLoansQuery)
  return sendPaginated(res, 'My loans listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.getLoan(getTenantId(req), getRouteParam(req, 'loanId'), scope)
  return sendSuccess(res, 'Loan fetched', item)
})

export const createLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.createLoan(getTenantId(req), req.context!.userId, req.body as CreateLoanInput, scope, auditMeta(req))
  return sendCreated(res, 'Loan created', item)
})

export const updateDraft = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.updateDraft(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'loanId'),
    req.body as UpdateLoanDraftInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Loan updated', item)
})

export const submitLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.submitLoan(getTenantId(req), req.context!.userId, getRouteParam(req, 'loanId'), scope, auditMeta(req))
  return sendSuccess(res, 'Loan submitted', item)
})

export const approveLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.approveLoan(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'loanId'),
    req.body as ApproveLoanInput,
    scope,
    hasPerm(req, 'hrms.loan.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Loan approved', item)
})

export const rejectLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.rejectLoan(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'loanId'),
    (req.body as RejectLoanInput).reason,
    scope,
    hasPerm(req, 'hrms.loan.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Loan rejected', item)
})

export const cancelLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.cancelLoan(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'loanId'),
    (req.body as CancelLoanInput).reason,
    scope,
    hasPerm(req, 'hrms.loan.manage'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Loan cancelled', item)
})

export const disburseLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.disburseLoan(
    getTenantId(req),
    getRouteParam(req, 'loanId'),
    req.body as DisburseLoanInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Loan disbursed', item)
})

export const closeLoan = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.closeLoan(getTenantId(req), getRouteParam(req, 'loanId'), scope, auditMeta(req))
  return sendSuccess(res, 'Loan closed', item)
})

export const skipInstallment = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.skipInstallment(
    getTenantId(req),
    getRouteParam(req, 'loanId'),
    getRouteParam(req, 'scheduleId'),
    (req.body as SkipInstallmentInput).reason,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Installment skipped', item)
})

export const partialRecover = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.partialRecover(
    getTenantId(req),
    getRouteParam(req, 'loanId'),
    getRouteParam(req, 'scheduleId'),
    req.body as PartialRecoverInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Installment partially recovered', item)
})

export const recordRepayment = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await loans.recordEarlyRepayment(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'loanId'),
    req.body as EarlyRepaymentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Repayment recorded', item)
})

export const getAccounting = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const { status } = req.query as unknown as LoanAccountingQuery
  const item = await loans.getLoan(getTenantId(req), getRouteParam(req, 'loanId'), scope)
  const repayments = item.repayments.filter((r) => {
    if (!status) return true
    const posted = Boolean(r.accountingVoucherId)
    return status === 'POSTED' ? posted : !posted
  })
  return sendSuccess(res, 'Loan accounting fetched', {
    loanId: item.id,
    code: item.code,
    disbursementVoucherId: item.disbursementVoucherId,
    disbursedAmount: item.disbursedAmount,
    repayments,
  })
})
