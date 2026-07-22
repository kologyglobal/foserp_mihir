import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './store-workbench.controller.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const view = requireAnyPermission(
  'manufacturing.store_workbench.view',
  'inventory.stock.view',
  'inventory.view',
)

router.get('/summary', view, controller.getSummary)
router.get('/reservations', view, controller.listReservations)
router.get('/issues', view, controller.listIssues)
router.get('/returns', view, controller.listReturns)
router.get('/wip', view, controller.listWip)
router.get('/finished-goods', view, controller.listFinishedGoods)
router.get('/reconciliation', view, controller.listReconciliation)

export default router
