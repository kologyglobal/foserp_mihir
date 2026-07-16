import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import { masterResourceParamSchema } from './master.validation.js'
import * as controller from './master.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

const lookupParams = tenantRouteParamSchema.and(masterResourceParamSchema)

router.get(
  '/:resource',
  validateParams(lookupParams),
  requirePermission('master.lookup.view'),
  controller.listLookups,
)

export default router
