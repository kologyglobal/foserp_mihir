import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './profile.controller.js'
import { createProfileSchema, listProfilesQuerySchema, updateProfileSchema } from './profile.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.profile.view'),
  validateQuery(listProfilesQuerySchema),
  controller.listProfiles,
)
router.post(
  '/',
  requirePermission('manufacturing.profile.manage'),
  validateBody(createProfileSchema),
  controller.createProfile,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.view'),
  controller.getProfile,
)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.manage'),
  validateBody(updateProfileSchema),
  controller.updateProfile,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.manage'),
  controller.deleteProfile,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.manage'),
  controller.activateProfile,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.manage'),
  controller.deactivateProfile,
)
router.get(
  '/:id/readiness',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.profile.view'),
  controller.getProfileReadiness,
)

export default router
