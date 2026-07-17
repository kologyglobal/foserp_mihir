import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  cancelJournalSchema,
  createJournalSchema,
  listJournalsQuerySchema,
  updateJournalSchema,
} from './journal.schemas.js'
import * as controller from './journal.controller.js'
import * as approvalController from '../approvals/approval.controller.js'
import {
  approvalDecisionSchema,
  rejectSchema,
  sendBackSchema,
} from '../approvals/approval.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.voucher.view'), validateQuery(listJournalsQuerySchema), controller.listJournals)
router.post('/', requirePermission('finance.voucher.create'), validateBody(createJournalSchema), controller.createJournal)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.voucher.view'), controller.getJournal)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.edit'),
  validateBody(updateJournalSchema),
  controller.updateJournal,
)
router.post(
  '/:id/validate',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.view'),
  controller.validateJournal,
)
router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.submit'),
  controller.submitJournal,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.cancel'),
  validateBody(cancelJournalSchema),
  controller.cancelJournal,
)
router.get(
  '/:id/audit',
  validateParams(uuidParamSchema),
  requirePermission('finance.audit.view'),
  controller.getJournalAudit,
)
router.get(
  '/:id/approvals',
  validateParams(uuidParamSchema),
  requireAnyPermission('finance.voucher.view', 'finance.voucher.approve', 'finance.audit.view'),
  approvalController.getJournalApprovals,
)
router.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.approve'),
  validateBody(approvalDecisionSchema),
  approvalController.approveJournal,
)
router.post(
  '/:id/send-back',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.approve'),
  validateBody(sendBackSchema),
  approvalController.sendBackJournal,
)
router.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.approve'),
  validateBody(rejectSchema),
  approvalController.rejectJournal,
)

export default router
