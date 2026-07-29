import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './inventory-gl-reconciliation.controller.js'
import {
  inventoryGlTrialBalanceQuerySchema,
  retryFailedEventBodySchema,
  unifiedFailedEventsQuerySchema,
} from './inventory-gl-reconciliation.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const viewTb = requireAnyPermission(
  'finance.gl.view',
  'manufacturing.accounting.reconcile',
  'inventory.view_cost',
  'finance.settings.view',
)

const viewFailed = requireAnyPermission(
  'finance.posting_event.view',
  'manufacturing.accounting.failed_events.view',
  'inventory.view_cost',
  'finance.gl.view',
)

const retryFailed = requireAnyPermission(
  'manufacturing.accounting.failed_events.retry',
  'manufacturing.accounting.retry',
  'finance.settings.manage',
)

router.get(
  '/trial-balance',
  viewTb,
  validateQuery(inventoryGlTrialBalanceQuerySchema),
  controller.getInventoryGlTrialBalance,
)

router.get(
  '/failed-events',
  viewFailed,
  validateQuery(unifiedFailedEventsQuerySchema),
  controller.listFailedAccountingEvents,
)

router.post(
  '/failed-events/:id/retry',
  validateParams(uuidParamSchema),
  retryFailed,
  validateBody(retryFailedEventBodySchema),
  controller.retryFailedAccountingEvent,
)

export default router
