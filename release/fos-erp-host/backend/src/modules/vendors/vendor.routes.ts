import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { createVendorSchema, listVendorsQuerySchema, updateVendorSchema, vendorLookupQuerySchema } from './vendor.validation.js'
import * as controller from './vendor.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('master.vendor.view'), validateQuery(listVendorsQuerySchema), controller.listVendors)
router.post('/', requirePermission('master.vendor.create'), validateBody(createVendorSchema), controller.createVendor)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('master.vendor.view'), controller.getVendor)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('master.vendor.update'),
  validateBody(updateVendorSchema),
  controller.updateVendor,
)
router.delete('/:id', validateParams(uuidParamSchema), requirePermission('master.vendor.delete'), controller.deleteVendor)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('master.vendor.update'),
  controller.activateVendor,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('master.vendor.update'),
  controller.deactivateVendor,
)

export default router

export const vendorLookupRouter = Router({ mergeParams: true })

vendorLookupRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

vendorLookupRouter.get('/', requirePermission('master.lookup.view'), validateQuery(vendorLookupQuerySchema), controller.listVendorLookups)
