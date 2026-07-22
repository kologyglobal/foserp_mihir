import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './warehouse-mapping.controller.js'
import {
  createWarehouseMappingSchema,
  listWarehouseMappingsQuerySchema,
  resolveWarehouseMappingQuerySchema,
  updateWarehouseMappingSchema,
} from './warehouse-mapping.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/resolve',
  requirePermission('manufacturing.warehouse_mapping.view'),
  validateQuery(resolveWarehouseMappingQuerySchema),
  controller.resolveMapping,
)
router.get(
  '/readiness',
  requirePermission('manufacturing.warehouse_mapping.view'),
  validateQuery(resolveWarehouseMappingQuerySchema),
  controller.getTenantReadiness,
)

router.get(
  '/',
  requirePermission('manufacturing.warehouse_mapping.view'),
  validateQuery(listWarehouseMappingsQuerySchema),
  controller.listMappings,
)
router.post(
  '/',
  requirePermission('manufacturing.warehouse_mapping.manage'),
  validateBody(createWarehouseMappingSchema),
  controller.createMapping,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.view'),
  controller.getMapping,
)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.manage'),
  validateBody(updateWarehouseMappingSchema),
  controller.updateMapping,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.manage'),
  controller.deleteMapping,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.manage'),
  controller.activateMapping,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.manage'),
  controller.deactivateMapping,
)
router.get(
  '/:id/readiness',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.warehouse_mapping.view'),
  controller.getMappingReadiness,
)

export default router
