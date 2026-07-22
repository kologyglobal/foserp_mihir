import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './inspection-plan.controller.js'
import {
  createPlanSchema,
  listPlansQuerySchema,
  replacePlanLinesSchema,
  revisePlanSchema,
  updatePlanSchema,
} from './inspection-plan.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('quality.view'), validateQuery(listPlansQuerySchema), controller.listPlans)

router.post('/', requirePermission('quality.create'), validateBody(createPlanSchema), controller.createPlan)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.getPlan)
router.get('/:id/revisions', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.listRevisions)
router.post('/:id/revise', validateParams(uuidParamSchema), requirePermission('quality.edit'), validateBody(revisePlanSchema), controller.revisePlan)
router.post('/:id/activate', validateParams(uuidParamSchema), requirePermission('quality.approve'), controller.activatePlan)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('quality.edit'),
  validateBody(updatePlanSchema),
  controller.updatePlan,
)

router.put(
  '/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('quality.edit'),
  validateBody(replacePlanLinesSchema),
  controller.replacePlanLines,
)

router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('quality.edit'),
  controller.deactivatePlan,
)

export default router
