import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './setup.controller.js'
import { inventorySetupBodySchema, lookupQuerySchema } from './setup.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requireAnyPermission('inventory.setup.manage', 'inventory.view', 'inventory.stock.view'),
  controller.getInventorySetup,
)

router.put(
  '/',
  requirePermission('inventory.setup.manage'),
  validateBody(inventorySetupBodySchema),
  controller.putInventorySetup,
)

router.get(
  '/lookup',
  requireAnyPermission(
    'inventory.view',
    'inventory.stock.view',
    'inventory.receipts.post',
    'inventory.issues.post',
    'inventory.post',
  ),
  validateQuery(lookupQuerySchema),
  controller.lookupInventoryCode,
)

export default router
