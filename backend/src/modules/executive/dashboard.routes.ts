import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../middleware/validation.middleware.js'
import * as controller from './dashboard.controller.js'
import {
  createDashboardSchema,
  updateDashboardSchema,
  batchWidgetQuerySchema,
} from './dashboard.validation.js'

/** Keep path params (e.g. :id) while validating tenant slug/id. */
const tenantRouteParamsKeep = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
  })
  .passthrough()
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

const dashboardIdParams = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  tenantSlug: z.string().min(2).max(100).optional(),
})

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamsKeep),
  resolveTenant,
  requireTenantAccess,
)

router.get('/widgets', requirePermission('executive.dashboard.view'), controller.listWidgets)
router.post(
  '/widgets/query',
  requirePermission('executive.dashboard.view'),
  validateBody(batchWidgetQuerySchema),
  controller.queryWidget,
)

router.get('/dashboards', requirePermission('executive.dashboard.view'), controller.listDashboards)
router.post(
  '/dashboards',
  requirePermission('executive.dashboard.configure'),
  validateBody(createDashboardSchema),
  controller.createDashboard,
)
router.get(
  '/dashboards/:id',
  requirePermission('executive.dashboard.view'),
  validateParams(dashboardIdParams),
  controller.getDashboard,
)
router.patch(
  '/dashboards/:id',
  requirePermission('executive.dashboard.configure'),
  validateParams(dashboardIdParams),
  validateBody(updateDashboardSchema),
  controller.updateDashboard,
)
router.delete(
  '/dashboards/:id',
  requirePermission('executive.dashboard.configure'),
  validateParams(dashboardIdParams),
  controller.deleteDashboard,
)
router.post(
  '/dashboards/:id/duplicate',
  requirePermission('executive.dashboard.configure'),
  validateParams(dashboardIdParams),
  controller.duplicateDashboard,
)
router.post(
  '/dashboards/:id/set-default',
  requirePermission('executive.dashboard.configure'),
  validateParams(dashboardIdParams),
  controller.setDefaultDashboard,
)

export default router
