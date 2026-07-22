import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import { z } from 'zod'
import inspectionRoutes from './inspections/inspection.routes.js'
import ncrRoutes from './ncrs/ncr.routes.js'
import parameterRoutes from './parameters/parameter.routes.js'
import inspectionPlanRoutes from './inspection-plans/inspection-plan.routes.js'
import certificateRoutes from './certificates/certificate.routes.js'
import { productionOrderIdParamSchema } from './inspections/inspection.schemas.js'
import * as blockersController from './blockers.controller.js'
import * as workspaceController from './workspace.controller.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.use('/inspections', inspectionRoutes)
router.use('/ncrs', ncrRoutes)
router.use('/parameters', parameterRoutes)
router.use('/inspection-plans', inspectionPlanRoutes)
router.use('/certificates', certificateRoutes)

router.get('/workspace/summary', requirePermission('quality.view'), workspaceController.summary)
router.get('/workspace/incoming', requirePermission('quality.view'), workspaceController.incoming)
router.get('/incoming/queue', requirePermission('quality.view'), workspaceController.incoming)
router.get('/workspace/in-process', requirePermission('quality.view'), workspaceController.summary)
router.get('/workspace/final', requirePermission('quality.view'), workspaceController.summary)
router.get('/workspace/job-work', requirePermission('quality.view'), workspaceController.summary)
router.get('/workspace/ncrs', requirePermission('quality.view'), workspaceController.summary)
router.get('/workspace/certificates', requirePermission('quality.view'), workspaceController.summary)

router.get(
  '/production-orders/:productionOrderId/blockers',
  validateParams(productionOrderIdParamSchema),
  requirePermission('quality.view'),
  blockersController.getProductionOrderBlockers,
)
router.get(
  '/job-work/:jobWorkOrderId/summary',
  validateParams(z.object({ tenantSlug: z.string().min(1), jobWorkOrderId: z.string().uuid() })),
  requirePermission('quality.view'),
  blockersController.getJobWorkSummary,
)
router.get(
  '/work-orders/:workOrderId/summary',
  validateParams(z.object({ tenantSlug: z.string().min(1), workOrderId: z.string().uuid() })),
  requirePermission('quality.view'),
  blockersController.getWorkOrderSummary,
)

export default router
