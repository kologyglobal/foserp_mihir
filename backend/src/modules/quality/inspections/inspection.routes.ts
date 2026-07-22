import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './inspection.controller.js'
import {
  cancelInspectionSchema,
  createInspectionSchema,
  decideInspectionSchema,
  listInspectionsQuerySchema,
} from './inspection.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('quality.view'),
  validateQuery(listInspectionsQuerySchema),
  controller.listInspections,
)

router.post(
  '/',
  requirePermission('quality.create'),
  validateBody(createInspectionSchema),
  controller.createInspection,
)

router.get('/:id', validateParams(uuidParamSchema), requirePermission('quality.view'), controller.getInspection)

router.post(
  '/:id/decide',
  validateParams(uuidParamSchema),
  requireAnyPermission('quality.submit', 'manufacturing.quality.inspect'),
  validateBody(decideInspectionSchema),
  controller.decideInspection,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('quality.cancel'),
  validateBody(cancelInspectionSchema),
  controller.cancelInspection,
)

export default router
