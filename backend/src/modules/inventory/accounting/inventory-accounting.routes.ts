import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './inventory-accounting.controller.js'
import { listInventoryAccountingEventsQuerySchema } from './inventory-accounting.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const view = requireAnyPermission('inventory.view_cost', 'inventory.view')

router.get('/gate', view, controller.getGateStatus)

router.get(
  '/events',
  view,
  validateQuery(listInventoryAccountingEventsQuerySchema),
  controller.listEvents,
)

router.get(
  '/events/:id',
  validateParams(uuidParamSchema),
  view,
  controller.getEvent,
)

export default router
