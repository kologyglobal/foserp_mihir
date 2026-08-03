import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './payroll.controller.js'
import {
  batchIdParamSchema,
  confirmPaymentSchema,
  createPaymentBatchSchema,
  createPeriodSchema,
  createRunSchema,
  employeeResultIdParamSchema,
  listEmployeeResultsQuerySchema,
  listExceptionsQuerySchema,
  listMyPayslipsQuerySchema,
  listPaymentBatchesQuerySchema,
  listPayslipsQuerySchema,
  listPeriodsQuerySchema,
  listRunsQuerySchema,
  payslipIdParamSchema,
  periodIdParamSchema,
  runIdParamSchema,
} from './payroll.schemas.js'

const router = Router({ mergeParams: true })

// ─── Periods ─────────────────────────────────────────────────────────────────

router.get('/periods', requirePermission('hrms.payroll.view'), validateQuery(listPeriodsQuerySchema), controller.listPeriods)
router.post('/periods', requirePermission('hrms.payroll.create'), validateBody(createPeriodSchema), controller.createPeriod)
router.get(
  '/periods/:periodId',
  validateParams(periodIdParamSchema),
  requirePermission('hrms.payroll.view'),
  controller.getPeriod,
)
router.post(
  '/periods/:periodId/close',
  validateParams(periodIdParamSchema),
  requirePermission('hrms.payroll.finalize'),
  controller.closePeriod,
)

// ─── Runs ────────────────────────────────────────────────────────────────────

router.get('/runs', requirePermission('hrms.payroll.view'), validateQuery(listRunsQuerySchema), controller.listRuns)
router.post('/runs', requirePermission('hrms.payroll.create'), validateBody(createRunSchema), controller.createRun)
router.get('/runs/:runId', validateParams(runIdParamSchema), requirePermission('hrms.payroll.view'), controller.getRun)

router.post(
  '/runs/:runId/calculate',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.calculate'),
  controller.calculateRun,
)
router.post(
  '/runs/:runId/review',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.review'),
  controller.reviewRun,
)
router.post(
  '/runs/:runId/finalize',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.finalize'),
  controller.finalizeRun,
)
router.post(
  '/runs/:runId/cancel',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.create'),
  controller.cancelRun,
)

// ─── Employee results & exceptions ──────────────────────────────────────────

router.get(
  '/runs/:runId/employees',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.view'),
  validateQuery(listEmployeeResultsQuerySchema),
  controller.listEmployeeResults,
)
router.get(
  '/runs/:runId/employees/:employeeResultId',
  validateParams(employeeResultIdParamSchema),
  requirePermission('hrms.payroll.view'),
  controller.getEmployeeResult,
)
router.get(
  '/runs/:runId/exceptions',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.view'),
  validateQuery(listExceptionsQuerySchema),
  controller.listExceptions,
)

// ─── Phase 9 — Payslips ──────────────────────────────────────────────────────

router.post(
  '/runs/:runId/payslips/generate',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payslip.generate'),
  controller.generatePayslipsForRun,
)

router.get('/payslips/mine', validateQuery(listMyPayslipsQuerySchema), controller.listMyPayslips)
router.get('/payslips', requirePermission('hrms.payslip.view'), validateQuery(listPayslipsQuerySchema), controller.listPayslips)
router.get(
  '/payslips/:payslipId',
  validateParams(payslipIdParamSchema),
  requirePermission('hrms.payslip.view'),
  controller.getPayslip,
)
router.get(
  '/payslips/:payslipId/html',
  validateParams(payslipIdParamSchema),
  requirePermission('hrms.payslip.view'),
  controller.getPayslipHtml,
)

// ─── Phase 9 — Payroll accounting ───────────────────────────────────────────

router.get(
  '/runs/:runId/accounting',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.accounting.view'),
  controller.getPayrollAccounting,
)
router.post(
  '/runs/:runId/accounting/post',
  validateParams(runIdParamSchema),
  requirePermission('hrms.payroll.accounting.post'),
  controller.postPayrollAccounting,
)

// ─── Phase 9 — Salary payment batches ───────────────────────────────────────

router.get(
  '/payment-batches',
  requirePermission('hrms.salary_payment.view'),
  validateQuery(listPaymentBatchesQuerySchema),
  controller.listPaymentBatches,
)
router.post(
  '/payment-batches',
  requirePermission('hrms.salary_payment.create'),
  validateBody(createPaymentBatchSchema),
  controller.createPaymentBatch,
)
router.get(
  '/payment-batches/:batchId',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.view'),
  controller.getPaymentBatch,
)
router.post(
  '/payment-batches/:batchId/ready',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.create'),
  controller.markPaymentBatchReady,
)
router.post(
  '/payment-batches/:batchId/approve',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.approve'),
  controller.approvePaymentBatch,
)
router.post(
  '/payment-batches/:batchId/confirm',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.confirm'),
  validateBody(confirmPaymentSchema),
  controller.confirmPaymentBatch,
)
router.get(
  '/payment-batches/:batchId/export',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.export'),
  controller.exportPaymentBatchCsv,
)
router.post(
  '/payment-batches/:batchId/cancel',
  validateParams(batchIdParamSchema),
  requirePermission('hrms.salary_payment.create'),
  controller.cancelPaymentBatch,
)

export default router
