import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as departmentController from './department.controller.js'
import {
  createDepartmentSchema,
  departmentIdParamSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.validation.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requirePermission('department.view'),
  validateQuery(listDepartmentsQuerySchema),
  asyncHandler(departmentController.list),
)

router.post(
  '/',
  requirePermission('department.create'),
  validateBody(createDepartmentSchema),
  asyncHandler(departmentController.create),
)

router.get(
  '/:departmentId',
  requirePermission('department.view'),
  validateParams(departmentIdParamSchema),
  asyncHandler(departmentController.getById),
)

router.patch(
  '/:departmentId',
  requirePermission('department.update'),
  validateParams(departmentIdParamSchema),
  validateBody(updateDepartmentSchema),
  asyncHandler(departmentController.update),
)

router.delete(
  '/:departmentId',
  requirePermission('department.delete'),
  validateParams(departmentIdParamSchema),
  asyncHandler(departmentController.remove),
)

export default router
