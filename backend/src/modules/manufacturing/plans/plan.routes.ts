import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './plan.controller.js'
import {
  cancelPlanSchema,
  createPlanSchema,
  generateWorkOrdersSchema,
  listPlansQuerySchema,
  updatePlanSchema,
} from './plan.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('manufacturing.production_plan.view'), validateQuery(listPlansQuerySchema), controller.listPlans)
router.post('/', requirePermission('manufacturing.production_plan.create'), validateBody(createPlanSchema), controller.createPlan)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.production_plan.view'), controller.getPlan)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.edit'),
  validateBody(updatePlanSchema),
  controller.updatePlan,
)
router.post(
  '/:id/release',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.release'),
  controller.releasePlan,
)
router.post(
  '/:id/preview-netting',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.view'),
  controller.previewNetting,
)
router.post(
  '/:id/generate-work-orders',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.create_work_order'),
  validateBody(generateWorkOrdersSchema),
  controller.generateWorkOrders,
)
router.post(
  '/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.close'),
  controller.closePlan,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production_plan.edit'),
  validateBody(cancelPlanSchema),
  controller.cancelPlan,
)

export default router
