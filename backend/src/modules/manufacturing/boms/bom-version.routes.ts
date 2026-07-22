import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './bom.controller.js'
import { compareBomVersionsQuerySchema, createBomLineSchema, updateBomVersionSchema } from './bom.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const versionIdParamSchema = z.object({ versionId: z.string().uuid() })

router.get(
  '/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.view'),
  controller.getBomVersion,
)
router.patch(
  '/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.edit'),
  validateBody(updateBomVersionSchema),
  controller.updateBomVersion,
)
router.get(
  '/:versionId/tree',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.view'),
  controller.getBomVersionTree,
)
router.post(
  '/:versionId/lines',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.create'),
  validateBody(createBomLineSchema),
  controller.createBomLine,
)
router.post(
  '/:versionId/validate',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.edit'),
  controller.validateBomVersion,
)
router.post(
  '/:versionId/activate',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.activate'),
  controller.activateBomVersion,
)
router.post(
  '/:versionId/revise',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.create'),
  controller.reviseBomVersion,
)
router.get(
  '/:versionId/compare',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.bom.view'),
  validateQuery(compareBomVersionsQuerySchema),
  controller.compareBomVersions,
)

export default router
