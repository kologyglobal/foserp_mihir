import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './transfer.controller.js'
import { createTransferSchema, listTransfersSchema, postingActionSchema, receiveTransferSchema, workflowActionSchema } from './transfer.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
router.get('/', requireAnyPermission('inventory.transfers.view', 'inventory.view'), validateQuery(listTransfersSchema), controller.list)
router.post('/', requireAnyPermission('inventory.transfers.create', 'inventory.transfer.create', 'inventory.create'), validateBody(createTransferSchema), controller.create)
router.get('/:id', requireAnyPermission('inventory.transfers.view', 'inventory.view'), validateParams(uuidParamSchema), controller.get)
router.post('/:id/submit', requireAnyPermission('inventory.submit', 'inventory.transfer.create'), validateParams(uuidParamSchema), validateBody(workflowActionSchema), controller.submit)
router.post('/:id/approve', requireAnyPermission('inventory.transfer.approve', 'inventory.approve'), validateParams(uuidParamSchema), validateBody(workflowActionSchema), controller.approve)
router.post('/:id/dispatch', requireAnyPermission('inventory.transfers.dispatch', 'inventory.transfer.dispatch'), validateParams(uuidParamSchema), validateBody(postingActionSchema), controller.dispatch)
router.post('/:id/receive', requireAnyPermission('inventory.transfers.receive', 'inventory.transfer.receive'), validateParams(uuidParamSchema), validateBody(receiveTransferSchema), controller.receive)
router.post('/:id/cancel', requireAnyPermission('inventory.transfers.cancel', 'inventory.cancel'), validateParams(uuidParamSchema), validateBody(workflowActionSchema), controller.cancel)
router.post('/:id/reverse', requireAnyPermission('inventory.override', 'inventory.issues.reverse'), validateParams(uuidParamSchema), validateBody(postingActionSchema), controller.reverse)
export default router
