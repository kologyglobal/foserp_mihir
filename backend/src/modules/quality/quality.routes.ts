import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { z } from 'zod'
import inspectionRoutes from './inspections/inspection.routes.js'
import ncrRoutes from './ncrs/ncr.routes.js'
import parameterRoutes from './parameters/parameter.routes.js'
import inspectionPlanRoutes from './inspection-plans/inspection-plan.routes.js'
import certificateRoutes from './certificates/certificate.routes.js'
import kioskRoutes from './kiosk/kiosk.routes.js'
import { productionOrderIdParamSchema } from './inspections/inspection.schemas.js'
import * as blockersController from './blockers.controller.js'
import * as workspaceController from './workspace.controller.js'
import { incomingQueueQuerySchema } from './incoming/incoming-workbench.service.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.use('/inspections', inspectionRoutes)
router.use('/ncrs', ncrRoutes)
router.use('/parameters', parameterRoutes)
router.use('/inspection-plans', inspectionPlanRoutes)
router.use('/certificates', certificateRoutes)
router.use('/kiosk', kioskRoutes)

router.get('/workspace/summary', requirePermission('quality.view'), workspaceController.summary)
router.get(
  '/workspace/incoming',
  requireAnyPermission('quality.view', 'quality.incoming.view', 'purchase.qi.view'),
  validateQuery(incomingQueueQuerySchema),
  workspaceController.incoming,
)
router.get(
  '/incoming/queue',
  requireAnyPermission('quality.view', 'quality.incoming.view', 'purchase.qi.view'),
  validateQuery(incomingQueueQuerySchema),
  workspaceController.incoming,
)
router.get(
  '/incoming/queue/legacy',
  requireAnyPermission('quality.view', 'quality.incoming.view', 'purchase.qi.view'),
  workspaceController.incomingLegacy,
)
router.get(
  '/incoming/reports',
  requireAnyPermission('quality.reports.view', 'quality.incoming.view', 'quality.view'),
  workspaceController.incomingReports,
)
router.post(
  '/incoming/assign',
  requireAnyPermission('purchase.qi.edit', 'quality.incoming.view'),
  validateBody(
    z.object({
      qualityInspectionId: z.string().uuid(),
      inspectedById: z.string().min(1).max(36),
      inspectedByName: z.string().max(200).optional(),
      priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
    }),
  ),
  workspaceController.assignInspector,
)
router.post(
  '/incoming/start',
  requireAnyPermission('purchase.qi.edit', 'quality.incoming.view'),
  validateBody(z.object({ qualityInspectionId: z.string().uuid() })),
  workspaceController.startInspection,
)
router.get(
  '/incoming/stock-status/grn/:goodsReceiptId',
  requireAnyPermission('quality.incoming.view', 'purchase.qi.view', 'purchase.grn.view', 'inventory.view'),
  validateParams(z.object({ tenantSlug: z.string().min(1), goodsReceiptId: z.string().uuid() })),
  workspaceController.stockStatusGrn,
)
router.get(
  '/incoming/stock-status/qi/:qualityInspectionId',
  requireAnyPermission('quality.incoming.view', 'purchase.qi.view'),
  validateParams(z.object({ tenantSlug: z.string().min(1), qualityInspectionId: z.string().uuid() })),
  workspaceController.stockStatusQi,
)
router.get(
  '/incoming/stock-status/item/:itemId',
  requireAnyPermission('quality.incoming.view', 'purchase.qi.view', 'inventory.view'),
  validateParams(z.object({ tenantSlug: z.string().min(1), itemId: z.string().uuid() })),
  workspaceController.stockStatusItem,
)

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
