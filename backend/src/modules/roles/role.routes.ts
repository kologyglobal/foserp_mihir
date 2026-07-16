import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as roleController from './role.controller.js'
import { createRoleSchema, roleIdParamSchema, updateRoleSchema } from './role.validation.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('role.view'), asyncHandler(roleController.list))

router.post(
  '/',
  requirePermission('role.create'),
  validateBody(createRoleSchema),
  asyncHandler(roleController.create),
)

// Declared before `/:roleId` so the literal path is matched first.
router.get('/permissions/catalog', requirePermission('role.view'), asyncHandler(roleController.listPermissions))

router.get(
  '/:roleId',
  requirePermission('role.view'),
  validateParams(roleIdParamSchema),
  asyncHandler(roleController.getById),
)

router.patch(
  '/:roleId',
  requirePermission('role.update'),
  validateParams(roleIdParamSchema),
  validateBody(updateRoleSchema),
  asyncHandler(roleController.update),
)

router.delete(
  '/:roleId',
  requirePermission('role.delete'),
  validateParams(roleIdParamSchema),
  asyncHandler(roleController.remove),
)

export default router
