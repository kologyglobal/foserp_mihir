import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../middleware/tenant.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './traceability.controller.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
router.use(requireAnyPermission('inventory.traceability.view', 'inventory.batch.view', 'inventory.serial.view'))

router.get('/batches/:id', validateParams(uuidParamSchema), controller.getBatchLineage)
router.get('/serials/:id', validateParams(uuidParamSchema), controller.getSerialLineage)
router.get('/items/:id', validateParams(uuidParamSchema), controller.getItemLineage)

export default router
