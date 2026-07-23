import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './ledger.controller.js'
import { listLedgerQuerySchema } from './ledger.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requireAnyPermission(
    'inventory.stock.view',
    'inventory.view_item_ledger',
    'inventory.view',
    'inventory.receipts.view',
    'inventory.returns.view',
    'inventory.issues.view',
  ),
  validateQuery(listLedgerQuerySchema),
  controller.listLedger,
)

router.get(
  '/:id',
  requireAnyPermission(
    'inventory.stock.view',
    'inventory.view_item_ledger',
    'inventory.view',
    'inventory.receipts.view',
    'inventory.returns.view',
    'inventory.issues.view',
  ),
  validateParams(uuidParamSchema),
  controller.getMovement,
)

export default router
