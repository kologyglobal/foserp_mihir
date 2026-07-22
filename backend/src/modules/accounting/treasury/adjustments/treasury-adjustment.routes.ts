import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveTreasuryAdjustmentSchema,
  cancelTreasuryAdjustmentSchema,
  createTreasuryAdjustmentSchema,
  listTreasuryAdjustmentsQuerySchema,
  markReadyTreasuryAdjustmentSchema,
  postTreasuryAdjustmentSchema,
  rejectTreasuryAdjustmentSchema,
  reverseTreasuryAdjustmentSchema,
  reviseTreasuryAdjustmentSchema,
  submitTreasuryAdjustmentSchema,
  updateTreasuryAdjustmentSchema,
} from './treasury-adjustment.schemas.js'
import * as controller from './treasury-adjustment.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.treasury.adjustment.view'), validateQuery(listTreasuryAdjustmentsQuerySchema), controller.listTreasuryAdjustments)
router.post('/', requirePermission('finance.treasury.adjustment.create'), validateBody(createTreasuryAdjustmentSchema), controller.createTreasuryAdjustment)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.adjustment.view'), controller.getTreasuryAdjustment)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.edit'),
  validateBody(updateTreasuryAdjustmentSchema),
  controller.updateTreasuryAdjustment,
)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.treasury.adjustment.view'), controller.validateTreasuryAdjustment)
router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.submit'),
  validateBody(submitTreasuryAdjustmentSchema),
  controller.submitTreasuryAdjustment,
)
router.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.approve'),
  validateBody(approveTreasuryAdjustmentSchema),
  controller.approveTreasuryAdjustment,
)
router.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.approve'),
  validateBody(rejectTreasuryAdjustmentSchema),
  controller.rejectTreasuryAdjustment,
)
router.post(
  '/:id/revise',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.edit'),
  validateBody(reviseTreasuryAdjustmentSchema),
  controller.reviseTreasuryAdjustment,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.edit'),
  validateBody(markReadyTreasuryAdjustmentSchema),
  controller.markTreasuryAdjustmentReady,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.cancel'),
  validateBody(cancelTreasuryAdjustmentSchema),
  controller.cancelTreasuryAdjustment,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.treasury.adjustment.view'), controller.getTreasuryAdjustmentApproval)

router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.post'),
  validateBody(postTreasuryAdjustmentSchema),
  controller.postTreasuryAdjustmentHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.adjustment.reverse'),
  validateBody(reverseTreasuryAdjustmentSchema),
  controller.reverseTreasuryAdjustmentHandler,
)

export default router
