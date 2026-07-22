import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import {
  createSavedViewSchema,
  listSavedViewsQuerySchema,
  savedViewIdParamSchema,
  updateSavedViewSchema,
} from './saved-view.schemas.js'
import * as controller from './saved-view.controller.js'

// Mounted under /reports/saved-views by ops-reports.routes.ts, which already applies
// authenticate/attachRequestContext/resolveTenant/requireTenantAccess.
const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('manufacturing.reports.saved_views'),
  validateQuery(listSavedViewsQuerySchema),
  controller.listSavedViews,
)
router.post(
  '/',
  requirePermission('manufacturing.reports.saved_views'),
  validateBody(createSavedViewSchema),
  controller.createSavedView,
)
router.get(
  '/:id',
  requirePermission('manufacturing.reports.saved_views'),
  validateParams(savedViewIdParamSchema),
  controller.getSavedView,
)
router.patch(
  '/:id',
  requirePermission('manufacturing.reports.saved_views'),
  validateParams(savedViewIdParamSchema),
  validateBody(updateSavedViewSchema),
  controller.updateSavedView,
)
router.delete(
  '/:id',
  requirePermission('manufacturing.reports.saved_views'),
  validateParams(savedViewIdParamSchema),
  controller.deleteSavedView,
)
router.post(
  '/:id/set-default',
  requirePermission('manufacturing.reports.saved_views'),
  validateParams(savedViewIdParamSchema),
  controller.setDefaultSavedView,
)

export default router
