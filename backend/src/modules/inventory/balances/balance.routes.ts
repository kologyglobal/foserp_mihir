import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './balance.controller.js'
import {
  listBalancesQuerySchema,
  reconcileBalancesQuerySchema,
  stockPositionQuerySchema,
} from './balance.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requireAnyPermission('inventory.stock.view', 'inventory.view_item_ledger', 'inventory.view'),
  validateQuery(listBalancesQuerySchema),
  controller.listBalances,
)

router.get(
  '/position',
  requireAnyPermission('inventory.stock.view', 'inventory.view_item_ledger', 'inventory.view'),
  validateQuery(stockPositionQuerySchema),
  controller.getStockPosition,
)

router.get(
  '/reconciliation',
  requireAnyPermission(
    'inventory.stock.view',
    'inventory.ledger.view',
    'inventory.exception.resolve',
    'inventory.view_audit',
    'inventory.view_item_ledger',
    'inventory.view',
  ),
  validateQuery(reconcileBalancesQuerySchema),
  controller.reconcileBalances,
)

export default router
