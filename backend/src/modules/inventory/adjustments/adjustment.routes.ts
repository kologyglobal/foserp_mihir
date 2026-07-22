import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './adjustment.controller.js'
import { adjustmentActionSchema, adjustmentPostingSchema, createAdjustmentSchema, listAdjustmentsSchema } from './adjustment.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
router.get('/', requireAnyPermission('inventory.adjustments.view', 'inventory.view'), validateQuery(listAdjustmentsSchema), controller.list)
router.post('/', requireAnyPermission('inventory.adjustments.create', 'inventory.adjustment.create', 'inventory.create'), validateBody(createAdjustmentSchema), controller.create)
router.get('/:id', requireAnyPermission('inventory.adjustments.view', 'inventory.view'), validateParams(uuidParamSchema), controller.get)
router.post('/:id/submit', requireAnyPermission('inventory.adjustments.submit', 'inventory.submit'), validateParams(uuidParamSchema), validateBody(adjustmentActionSchema), controller.submit)
router.post('/:id/approve', requireAnyPermission('inventory.adjustments.approve', 'inventory.adjustment.approve'), validateParams(uuidParamSchema), validateBody(adjustmentActionSchema), controller.approve)
router.post('/:id/post', requireAnyPermission('inventory.adjustments.post', 'inventory.post'), validateParams(uuidParamSchema), validateBody(adjustmentPostingSchema), controller.post)
router.post('/:id/reverse', requireAnyPermission('inventory.override', 'inventory.adjustment.approve'), validateParams(uuidParamSchema), validateBody(adjustmentPostingSchema), controller.reverse)
export default router
