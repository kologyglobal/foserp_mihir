import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './parameter.controller.js'
import { createParameterSchema, listParametersQuerySchema, updateParameterSchema } from './parameter.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('quality.view'),
  validateQuery(listParametersQuerySchema),
  controller.listParameters,
)

router.post(
  '/',
  requirePermission('quality.create'),
  validateBody(createParameterSchema),
  controller.createParameter,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.getParameter)

router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('quality.edit'),
  validateBody(updateParameterSchema),
  controller.updateParameter,
)

router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('quality.edit'),
  controller.deactivateParameter,
)

export default router
