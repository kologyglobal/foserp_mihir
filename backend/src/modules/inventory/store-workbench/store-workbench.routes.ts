import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './store-workbench.controller.js'
import { needsActionDomainParamSchema, needsActionQuerySchema } from './store-workbench.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const view = requireAnyPermission(
  'inventory.stock.view',
  'inventory.view',
  'manufacturing.store_workbench.view',
)

router.get('/summary', view, controller.getSummary)
router.get('/needs-action', view, validateQuery(needsActionQuerySchema), controller.listNeedsAction)
router.get(
  '/needs-action/:domain',
  validateParams(needsActionDomainParamSchema),
  view,
  validateQuery(needsActionQuerySchema),
  controller.listNeedsActionForDomain,
)

// Thin aliases to the manufacturing store-workbench queues (same shapes).
router.get('/reservations', view, controller.listReservations)
router.get('/issues', view, controller.listIssues)
router.get('/returns', view, controller.listReturns)
router.get('/wip', view, controller.listWip)
router.get('/finished-goods', view, controller.listFinishedGoods)
router.get('/reconciliation', view, controller.listReconciliation)

export default router
