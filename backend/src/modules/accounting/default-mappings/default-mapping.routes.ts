import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import {
  defaultMappingsQuerySchema,
  upsertDefaultMappingsSchema,
} from './default-mapping.validation.js'
import * as controller from './default-mapping.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.default_mapping.view'), validateQuery(defaultMappingsQuerySchema), controller.listDefaultMappings)
router.put('/', requirePermission('finance.default_mapping.manage'), validateBody(upsertDefaultMappingsSchema), controller.upsertDefaultMappings)
router.get('/validate', requirePermission('finance.default_mapping.view'), validateQuery(defaultMappingsQuerySchema), controller.validateDefaultMappings)

export default router
