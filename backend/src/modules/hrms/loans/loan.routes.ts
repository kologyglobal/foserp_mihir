import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './loan.controller.js'
import {
  approveLoanSchema,
  cancelLoanSchema,
  createLoanSchema,
  disburseLoanSchema,
  earlyRepaymentSchema,
  listLoansQuerySchema,
  listMyLoansQuerySchema,
  loanAccountingQuerySchema,
  loanIdParamSchema,
  loanScheduleIdParamSchema,
  partialRecoverSchema,
  rejectLoanSchema,
  skipInstallmentSchema,
  updateLoanDraftSchema,
} from './loan.schemas.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('hrms.loan.view'), validateQuery(listLoansQuerySchema), controller.listLoans)
router.post('/', requirePermission('hrms.loan.create'), validateBody(createLoanSchema), controller.createLoan)
router.get('/mine', validateQuery(listMyLoansQuerySchema), controller.listMine)
router.get('/:loanId', validateParams(loanIdParamSchema), requirePermission('hrms.loan.view'), controller.getLoan)
router.patch(
  '/:loanId',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.create'),
  validateBody(updateLoanDraftSchema),
  controller.updateDraft,
)

router.post(
  '/:loanId/submit',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.create'),
  controller.submitLoan,
)
router.post(
  '/:loanId/approve',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.approve'),
  validateBody(approveLoanSchema),
  controller.approveLoan,
)
router.post(
  '/:loanId/reject',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.approve'),
  validateBody(rejectLoanSchema),
  controller.rejectLoan,
)
router.post(
  '/:loanId/disburse',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.disburse'),
  validateBody(disburseLoanSchema),
  controller.disburseLoan,
)
router.post(
  '/:loanId/cancel',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.create'),
  validateBody(cancelLoanSchema),
  controller.cancelLoan,
)
router.post(
  '/:loanId/close',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.manage'),
  controller.closeLoan,
)

router.post(
  '/:loanId/schedules/:scheduleId/skip',
  validateParams(loanScheduleIdParamSchema),
  requirePermission('hrms.loan.manage'),
  validateBody(skipInstallmentSchema),
  controller.skipInstallment,
)
router.post(
  '/:loanId/schedules/:scheduleId/partial',
  validateParams(loanScheduleIdParamSchema),
  requirePermission('hrms.loan.manage'),
  validateBody(partialRecoverSchema),
  controller.partialRecover,
)

router.post(
  '/:loanId/repayments',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.repayment'),
  validateBody(earlyRepaymentSchema),
  controller.recordRepayment,
)

router.get(
  '/:loanId/accounting',
  validateParams(loanIdParamSchema),
  requirePermission('hrms.loan.view'),
  validateQuery(loanAccountingQuerySchema),
  controller.getAccounting,
)

export default router
