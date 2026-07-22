import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './work-centre.controller.js'
import {
  createWorkCentreSchema,
  listWorkCentresQuerySchema,
  updateWorkCentreSchema,
} from './work-centre.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.work_centre.view'),
  validateQuery(listWorkCentresQuerySchema),
  controller.listWorkCentres,
)
router.post(
  '/',
  requirePermission('manufacturing.work_centre.manage'),
  validateBody(createWorkCentreSchema),
  controller.createWorkCentre,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_centre.view'),
  controller.getWorkCentre,
)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_centre.manage'),
  validateBody(updateWorkCentreSchema),
  controller.updateWorkCentre,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_centre.manage'),
  controller.deleteWorkCentre,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_centre.manage'),
  controller.activateWorkCentre,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_centre.manage'),
  controller.deactivateWorkCentre,
)

export default router
