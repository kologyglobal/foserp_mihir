import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './routing.controller.js'
import {
  compareRoutingVersionsQuerySchema,
  createDependencySchema,
  createOperationSchema,
  createStageGroupSchema,
  updateRoutingVersionSchema,
} from './routing.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const versionIdParamSchema = z.object({ versionId: z.string().uuid() })

router.get(
  '/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.view'),
  controller.getRoutingVersion,
)
router.patch(
  '/:versionId',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  validateBody(updateRoutingVersionSchema),
  controller.updateRoutingVersion,
)
router.post(
  '/:versionId/stage-groups',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.create'),
  validateBody(createStageGroupSchema),
  controller.createStageGroup,
)
router.post(
  '/:versionId/operations',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.create'),
  validateBody(createOperationSchema),
  controller.createOperation,
)
router.post(
  '/:versionId/dependencies',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.create'),
  validateBody(createDependencySchema),
  controller.createDependency,
)
router.post(
  '/:versionId/validate',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.edit'),
  controller.validateRoutingVersion,
)
router.post(
  '/:versionId/activate',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.activate'),
  controller.activateRoutingVersion,
)
router.post(
  '/:versionId/revise',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.create'),
  controller.reviseRoutingVersion,
)
router.get(
  '/:versionId/compare',
  validateParams(versionIdParamSchema),
  requirePermission('manufacturing.routes.view'),
  validateQuery(compareRoutingVersionsQuerySchema),
  controller.compareRoutingVersions,
)

export default router
