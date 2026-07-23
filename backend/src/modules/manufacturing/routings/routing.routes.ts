import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './routing.controller.js'
import {
  createRoutingSchema,
  createRoutingVersionSchema,
  listRoutingVersionsQuerySchema,
  listRoutingsQuerySchema,
  updateRoutingSchema,
} from './routing.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const routingIdParamSchema = z.object({ routingId: z.string().uuid() })

router.get('/', requirePermission('manufacturing.routes.view'), validateQuery(listRoutingsQuerySchema), controller.listRoutings)
router.post('/', requirePermission('manufacturing.routes.create'), validateBody(createRoutingSchema), controller.createRouting)

router.get(
  '/:routingId',
  validateParams(routingIdParamSchema),
  requirePermission('manufacturing.routes.view'),
  controller.getRouting,
)

router.patch(
  '/:routingId',
  validateParams(routingIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  validateBody(updateRoutingSchema),
  controller.updateRouting,
)

router.get(
  '/:routingId/versions',
  validateParams(routingIdParamSchema),
  requirePermission('manufacturing.routes.view'),
  validateQuery(listRoutingVersionsQuerySchema),
  controller.listRoutingVersions,
)
router.post(
  '/:routingId/versions',
  validateParams(routingIdParamSchema),
  requirePermission('manufacturing.routes.create'),
  validateBody(createRoutingVersionSchema),
  controller.createRoutingVersion,
)

export default router
