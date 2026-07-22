import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './requisition.controller.js'
import {
  cancelRequisitionSchema,
  createRequisitionSchema,
  fromProductionShortageSchema,
  lineIdParamSchema,
  listRequisitionsQuerySchema,
  productionOrderIdParamSchema,
  rejectRequisitionSchema,
  requisitionLineInputSchema,
  updateRequisitionLineSchema,
  updateRequisitionSchema,
} from './requisition.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('purchase.requisition.view'),
  validateQuery(listRequisitionsQuerySchema),
  controller.listRequisitions,
)

router.post(
  '/',
  requirePermission('purchase.requisition.create'),
  validateBody(createRequisitionSchema),
  controller.createRequisition,
)

router.post(
  '/from-production-shortage',
  requirePermission('purchase.requisition.create'),
  validateBody(fromProductionShortageSchema),
  controller.createFromProductionShortage,
)

router.get(
  '/by-production-order/:productionOrderId',
  requirePermission('purchase.requisition.view'),
  validateParams(productionOrderIdParamSchema),
  controller.listByProductionOrder,
)

router.patch(
  '/lines/:lineId',
  validateParams(lineIdParamSchema),
  requirePermission('purchase.requisition.edit'),
  validateBody(updateRequisitionLineSchema),
  controller.updateLine,
)

router.delete(
  '/lines/:lineId',
  validateParams(lineIdParamSchema),
  requirePermission('purchase.requisition.edit'),
  controller.deleteLine,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('purchase.requisition.view'), controller.getRequisition)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('purchase.requisition.edit'),
  validateBody(updateRequisitionSchema),
  controller.updateRequisition,
)

router.post(
  '/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('purchase.requisition.edit'),
  validateBody(requisitionLineInputSchema),
  controller.addLine,
)

router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('purchase.requisition.submit'),
  controller.submitRequisition,
)

router.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('purchase.requisition.approve'),
  controller.approveRequisition,
)

router.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('purchase.requisition.approve'),
  validateBody(rejectRequisitionSchema),
  controller.rejectRequisition,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requireAnyPermission('purchase.requisition.cancel', 'purchase.cancel'),
  validateBody(cancelRequisitionSchema),
  controller.cancelRequisition,
)

export default router
