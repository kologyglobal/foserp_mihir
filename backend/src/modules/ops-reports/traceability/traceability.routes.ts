import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './traceability.controller.js'
import { traceabilityEntityParamSchema, traceabilitySearchQuerySchema } from './traceability.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/search',
  requirePermission('manufacturing.traceability.view'),
  validateQuery(traceabilitySearchQuerySchema),
  controller.search,
)
router.get(
  '/:entityType/:entityId',
  requirePermission('manufacturing.traceability.view'),
  validateParams(traceabilityEntityParamSchema),
  controller.getLineage,
)

export default router
