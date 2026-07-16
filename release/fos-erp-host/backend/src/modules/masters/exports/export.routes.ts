import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './export.controller.js'
import { masterExportQuerySchema } from './export.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/items', requirePermission('master.item.view'), validateQuery(masterExportQuerySchema), controller.exportItems)
router.get('/vendors', requirePermission('master.vendor.view'), validateQuery(masterExportQuerySchema), controller.exportVendors)
router.get('/hsn-sac', requirePermission('master.hsn.view'), validateQuery(masterExportQuerySchema), controller.exportHsnSac)

export default router
