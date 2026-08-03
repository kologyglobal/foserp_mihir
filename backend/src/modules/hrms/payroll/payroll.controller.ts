import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as periodService from './payroll-period.service.js'
import * as runService from './payroll-run.service.js'
import * as exceptionService from './payroll-exception.service.js'
import * as payslipService from './payslip.service.js'
import * as payrollAccountingService from './payroll-accounting.service.js'
import * as salaryPaymentService from './salary-payment.service.js'
import type {
  ConfirmPaymentInput,
  CreatePaymentBatchInput,
  CreatePeriodInput,
  CreateRunInput,
  ListEmployeeResultsQuery,
  ListExceptionsQuery,
  ListMyPayslipsQuery,
  ListPaymentBatchesQuery,
  ListPayslipsQuery,
  ListPeriodsQuery,
  ListRunsQuery,
} from './payroll.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export const listPeriods = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await periodService.listPeriods(getTenantId(req), scope, req.query as unknown as ListPeriodsQuery)
  return sendPaginated(res, 'Payroll periods listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createPeriod = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await periodService.createPeriod(getTenantId(req), req.body as CreatePeriodInput, scope, auditMeta(req))
  return sendCreated(res, 'Payroll period created', item)
})

export const getPeriod = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await periodService.getPeriod(getTenantId(req), getRouteParam(req, 'periodId'), scope)
  return sendSuccess(res, 'Payroll period fetched', item)
})

export const closePeriod = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await periodService.closePeriod(getTenantId(req), getRouteParam(req, 'periodId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payroll period closed', item)
})

// ─── Runs ────────────────────────────────────────────────────────────────────

export const listRuns = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await runService.listRuns(getTenantId(req), scope, req.query as unknown as ListRunsQuery)
  return sendPaginated(res, 'Payroll runs listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.createRun(getTenantId(req), req.body as CreateRunInput, scope, auditMeta(req))
  return sendCreated(res, 'Payroll run created', item)
})

export const getRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.getRun(getTenantId(req), getRouteParam(req, 'runId'), scope)
  return sendSuccess(res, 'Payroll run fetched', item)
})

export const calculateRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.calculateRun(getTenantId(req), getRouteParam(req, 'runId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payroll run calculated', item)
})

export const reviewRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.reviewRun(getTenantId(req), getRouteParam(req, 'runId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payroll run reviewed', item)
})

export const finalizeRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.finalizeRun(getTenantId(req), getRouteParam(req, 'runId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payroll run finalized', item)
})

export const cancelRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.cancelRun(getTenantId(req), getRouteParam(req, 'runId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payroll run cancelled', item)
})

// ─── Employee results & exceptions ──────────────────────────────────────────

export const listEmployeeResults = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await runService.listEmployeeResults(
    getTenantId(req),
    getRouteParam(req, 'runId'),
    scope,
    req.query as unknown as ListEmployeeResultsQuery,
  )
  return sendPaginated(res, 'Payroll employee results listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getEmployeeResult = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await runService.getEmployeeResult(
    getTenantId(req),
    getRouteParam(req, 'runId'),
    getRouteParam(req, 'employeeResultId'),
    scope,
  )
  return sendSuccess(res, 'Payroll employee result fetched', item)
})

export const listExceptions = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await exceptionService.listExceptions(
    getTenantId(req),
    getRouteParam(req, 'runId'),
    scope,
    req.query as unknown as ListExceptionsQuery,
  )
  return sendPaginated(res, 'Payroll exceptions listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

// ─── Phase 9 — Payslips ──────────────────────────────────────────────────────

export const generatePayslipsForRun = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await payslipService.generatePayslipsForRun(getTenantId(req), getRouteParam(req, 'runId'), scope, auditMeta(req))
  return sendSuccess(res, 'Payslips generated', item)
})

export const listPayslips = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await payslipService.listPayslips(getTenantId(req), scope, req.query as unknown as ListPayslipsQuery)
  return sendPaginated(res, 'Payslips listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const listMyPayslips = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.context?.userId
  if (!userId) throw new Error('Request context not initialized')
  const result = await payslipService.listMyPayslips(getTenantId(req), userId, req.query as unknown as ListMyPayslipsQuery)
  return sendPaginated(res, 'My payslips listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getPayslip = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await payslipService.getPayslip(getTenantId(req), getRouteParam(req, 'payslipId'), scope)
  return sendSuccess(res, 'Payslip fetched', item)
})

export const getPayslipHtml = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const html = await payslipService.getPayslipHtml(getTenantId(req), getRouteParam(req, 'payslipId'), scope)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(html)
})

// ─── Phase 9 — Payroll accounting ───────────────────────────────────────────

export const getPayrollAccounting = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await payrollAccountingService.getPayrollAccounting(getTenantId(req), getRouteParam(req, 'runId'), scope)
  return sendSuccess(res, 'Payroll accounting status fetched', item)
})

export const postPayrollAccounting = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await payrollAccountingService.postPayrollAccounting(
    getTenantId(req),
    getRouteParam(req, 'runId'),
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Payroll accounting posted', item)
})

// ─── Phase 9 — Salary payment batches ───────────────────────────────────────

export const listPaymentBatches = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await salaryPaymentService.listBatches(getTenantId(req), scope, req.query as unknown as ListPaymentBatchesQuery)
  return sendPaginated(res, 'Salary payment batches listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createPaymentBatch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.createBatch(getTenantId(req), req.body as CreatePaymentBatchInput, scope, auditMeta(req))
  return sendCreated(res, 'Salary payment batch created', item)
})

export const getPaymentBatch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.getBatch(getTenantId(req), getRouteParam(req, 'batchId'), scope)
  return sendSuccess(res, 'Salary payment batch fetched', item)
})

export const markPaymentBatchReady = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.markReady(getTenantId(req), getRouteParam(req, 'batchId'), scope, auditMeta(req))
  return sendSuccess(res, 'Salary payment batch marked ready', item)
})

export const approvePaymentBatch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.approveBatch(getTenantId(req), getRouteParam(req, 'batchId'), scope, auditMeta(req))
  return sendSuccess(res, 'Salary payment batch approved', item)
})

export const confirmPaymentBatch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.confirmPayment(
    getTenantId(req),
    getRouteParam(req, 'batchId'),
    req.body as ConfirmPaymentInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Salary payment batch confirmed', item)
})

export const exportPaymentBatchCsv = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const { filename, csv } = await salaryPaymentService.exportCsv(getTenantId(req), getRouteParam(req, 'batchId'), scope, auditMeta(req))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send(csv)
})

export const cancelPaymentBatch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await salaryPaymentService.cancelBatch(getTenantId(req), getRouteParam(req, 'batchId'), scope, auditMeta(req))
  return sendSuccess(res, 'Salary payment batch cancelled', item)
})
