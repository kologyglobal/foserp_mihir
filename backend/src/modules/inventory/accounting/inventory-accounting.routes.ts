import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './inventory-accounting.controller.js'
import {
  listInventoryAccountingEventsQuerySchema,
  putInventoryAccountingFeatureSchema,
} from './inventory-accounting.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const view = requireAnyPermission('inventory.view_cost', 'inventory.view')
const manage = requireAnyPermission('finance.settings.manage', 'tenant.manage')

const legalEntityParamSchema = z.object({
  legalEntityId: z.string().uuid(),
})

router.get('/gate', view, controller.getGateStatus)

router.get(
  '/feature-controls/:legalEntityId',
  validateParams(legalEntityParamSchema),
  view,
  controller.getFeatureStatus,
)

router.put(
  '/feature-controls/:legalEntityId',
  validateParams(legalEntityParamSchema),
  manage,
  validateBody(putInventoryAccountingFeatureSchema),
  controller.putFeatureControl,
)

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
