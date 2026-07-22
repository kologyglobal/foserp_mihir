import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './stock-count.controller.js'
import { createStockCountSchema, enterCountsSchema, listStockCountsSchema, stockCountActionSchema, stockCountPostingSchema } from './stock-count.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
router.get('/', requireAnyPermission('inventory.stock_count.view', 'inventory.view'), validateQuery(listStockCountsSchema), controller.list)
router.post('/', requireAnyPermission('inventory.stock_count.create', 'inventory.count.create', 'inventory.create'), validateBody(createStockCountSchema), controller.create)
router.get('/:id', requireAnyPermission('inventory.stock_count.view', 'inventory.view'), validateParams(uuidParamSchema), controller.get)
router.post('/:id/snapshot', requireAnyPermission('inventory.stock_count.create', 'inventory.count.create'), validateParams(uuidParamSchema), validateBody(stockCountActionSchema), controller.snapshot)
router.put('/:id/counts', requireAnyPermission('inventory.stock_count.count', 'inventory.count.create'), validateParams(uuidParamSchema), validateBody(enterCountsSchema), controller.enter)
router.post('/:id/submit', requireAnyPermission('inventory.stock_count.review', 'inventory.submit'), validateParams(uuidParamSchema), validateBody(stockCountActionSchema), controller.submit)
router.post('/:id/approve', requireAnyPermission('inventory.stock_count.approve', 'inventory.approve'), validateParams(uuidParamSchema), validateBody(stockCountActionSchema), controller.approve)
router.post('/:id/post', requireAnyPermission('inventory.stock_count.post', 'inventory.count.post'), validateParams(uuidParamSchema), validateBody(stockCountPostingSchema), controller.post)
router.post('/:id/reverse', requireAnyPermission('inventory.override', 'inventory.count.post'), validateParams(uuidParamSchema), validateBody(stockCountPostingSchema), controller.reverse)
export default router
