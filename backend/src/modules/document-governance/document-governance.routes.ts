import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as controller from './document-governance.controller.js'
import {
  createDateControlSchema,
  createProfileSchema,
  dateControlIdParamSchema,
  listDateControlsQuerySchema,
  profileIdParamSchema,
  updateDateControlSchema,
  updateProfileSchema,
} from './document-governance.validation.js'

/**
 * Tenant-scoped Document Governance admin APIs.
 * Path: /api/v1/t/:tenantSlug/admin/document-governance/*  (and tenants/:tenantId alias)
 *
 * Configuration only — does not enforce dates on document workflows.
 */
const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/feature-flag',
  requirePermission('platform.document_governance.view'),
  asyncHandler(controller.featureFlagStatus),
)

router.get(
  '/document-types',
  requirePermission('platform.document_governance.view'),
  asyncHandler(controller.listDocumentTypesHandler),
)

router.get(
  '/profiles',
  requirePermission('platform.document_governance.view'),
  asyncHandler(controller.listProfiles),
)

router.post(
  '/profiles',
  requirePermission('platform.document_governance.manage'),
  validateBody(createProfileSchema),
  asyncHandler(controller.createProfile),
)

router.patch(
  '/profiles/:id',
  requirePermission('platform.document_governance.manage'),
  validateParams(profileIdParamSchema),
  validateBody(updateProfileSchema),
  asyncHandler(controller.updateProfile),
)

router.get(
  '/date-controls',
  requirePermission('platform.document_governance.view'),
  validateQuery(listDateControlsQuerySchema),
  asyncHandler(controller.listDateControls),
)

router.get(
  '/date-controls/:id',
  requirePermission('platform.document_governance.view'),
  validateParams(dateControlIdParamSchema),
  asyncHandler(controller.getDateControl),
)

router.post(
  '/date-controls',
  requirePermission('platform.document_governance.manage'),
  validateBody(createDateControlSchema),
  asyncHandler(controller.createDateControl),
)

router.patch(
  '/date-controls/:id',
  requirePermission('platform.document_governance.manage'),
  validateParams(dateControlIdParamSchema),
  validateBody(updateDateControlSchema),
  asyncHandler(controller.updateDateControl),
)

router.post(
  '/date-controls/:id/activate',
  requirePermission('platform.document_governance.activate'),
  validateParams(dateControlIdParamSchema),
  asyncHandler(controller.activateDateControl),
)

router.post(
  '/date-controls/:id/deactivate',
  requirePermission('platform.document_governance.activate'),
  validateParams(dateControlIdParamSchema),
  asyncHandler(controller.deactivateDateControl),
)

router.post(
  '/date-controls/:id/reset-current-behaviour',
  requirePermission('platform.document_governance.manage'),
  validateParams(dateControlIdParamSchema),
  asyncHandler(controller.resetDateControl),
)

export default router
