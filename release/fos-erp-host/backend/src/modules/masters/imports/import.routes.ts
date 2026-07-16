import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './import.controller.js'
import { importPayloadSchema } from './import.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/items/template', requirePermission('master.item.view'), controller.getItemImportTemplate)
router.get('/vendors/template', requirePermission('master.vendor.view'), controller.getVendorImportTemplate)
router.get('/hsn-sac/template', requirePermission('master.hsn.view'), controller.getHsnSacImportTemplate)
router.post('/items', requirePermission('master.item.import'), validateBody(importPayloadSchema), controller.importItems)
router.post('/vendors', requirePermission('master.vendor.import'), validateBody(importPayloadSchema), controller.importVendors)
router.post('/hsn-sac', requirePermission('master.hsn.import'), validateBody(importPayloadSchema), controller.importHsnSac)

export default router
