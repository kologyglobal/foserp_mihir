import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import {
  attachRequestContext,
  requirePermission,
  requireSuperAdmin,
} from '../../middleware/request-context.middleware.js'
import { resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantIdParamSchema } from '../../utils/pagination.js'
import * as tenantController from './tenant.controller.js'
import { createTenantSchema, listTenantsQuerySchema, updateTenantSchema } from './tenant.validation.js'

const router = Router()

router.post(
  '/',
  authenticate,
  attachRequestContext,
  requireSuperAdmin,
  validateBody(createTenantSchema),
  asyncHandler(tenantController.create),
)

router.get(
  '/',
  authenticate,
  attachRequestContext,
  requireSuperAdmin,
  validateQuery(listTenantsQuerySchema),
  asyncHandler(tenantController.list),
)

router.get(
  '/:tenantId',
  authenticate,
  attachRequestContext,
  validateParams(tenantIdParamSchema),
  resolveTenant,
  requirePermission('tenant.view'),
  asyncHandler(tenantController.getById),
)

router.patch(
  '/:tenantId',
  authenticate,
  attachRequestContext,
  validateParams(tenantIdParamSchema),
  resolveTenant,
  requirePermission('tenant.update'),
  validateBody(updateTenantSchema),
  asyncHandler(tenantController.update),
)

router.delete(
  '/:tenantId',
  authenticate,
  attachRequestContext,
  validateParams(tenantIdParamSchema),
  resolveTenant,
  requirePermission('tenant.delete'),
  asyncHandler(tenantController.remove),
)

export default router
