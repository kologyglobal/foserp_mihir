import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './work-order.controller.js'
import * as assignmentController from '../assignments/assignment.controller.js'
import {
  cancelWorkOrderSchema,
  completeStageSchema,
  completeWorkOrderSchema,
  correctProgressSchema,
  createManualWorkOrderSchema,
  holdWorkOrderSchema,
  listWorkOrdersQuerySchema,
  recordProgressSchema,
  resumeWorkOrderSchema,
  splitWorkOrderSchema,
  startWorkOrderSchema,
} from './work-order.schemas.js'
import { listAssignmentsQuerySchema } from '../assignments/assignment.schemas.js'
import materialRoutes from '../materials/material.routes.js'
import runtimeChangeRoutes from '../runtime-changes/runtime-change.routes.js'
import wipMovementRoutes, { transferToRouter } from '../wip-movements/wip-movement.routes.js'
import fgReceiptRoutes from '../fg-receipts/fg-receipt.routes.js'
import * as fgController from '../fg-receipts/fg-receipt.controller.js'
import * as accountingController from '../accounting/manufacturing-accounting.controller.js'
import { z } from 'zod'

const transferToParamsSchema = z.object({
  id: z.string().uuid(),
  targetId: z.string().uuid(),
})

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('manufacturing.work_orders.view'), validateQuery(listWorkOrdersQuerySchema), controller.listWorkOrders)
router.post(
  '/',
  requirePermission('manufacturing.work_orders.create'),
  validateBody(createManualWorkOrderSchema),
  controller.createManualWorkOrder,
)

router.get('/summary', requirePermission('manufacturing.work_orders.view'), controller.getWorkOrdersSummary)

router.get(
  '/:id/assignments',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.assignment.view'),
  validateQuery(listAssignmentsQuerySchema),
  assignmentController.listWorkOrderAssignments,
)
router.use('/:id/materials', validateParams(uuidParamSchema), materialRoutes)
router.use('/:id/runtime-changes', validateParams(uuidParamSchema), runtimeChangeRoutes)
router.use('/:id/wip-movements', validateParams(uuidParamSchema), wipMovementRoutes)
router.use('/:id/transfer-to/:targetId', validateParams(transferToParamsSchema), transferToRouter)
router.use('/:id/fg-receipts', validateParams(uuidParamSchema), fgReceiptRoutes)

router.get(
  '/:id/fg-eligibility',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.fg_receipt.view'),
  fgController.getEligibility,
)

router.get(
  '/:id/wip-position',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.wip_stock.view', 'manufacturing.wip.move'),
  controller.getWipPosition,
)

router.get(
  '/:id/close-readiness',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.work_order.close_readiness', 'manufacturing.work_orders.view'),
  controller.getCloseReadiness,
)

router.get(
  '/:id/costing/preview',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.cost.view'),
  accountingController.getCostPreview,
)
router.get(
  '/:id/quality-blockers',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.view'),
  controller.getQualityBlockers,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.work_orders.view'), controller.getWorkOrder)
router.get(
  '/:id/detail',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.view'),
  controller.getWorkOrderDetail,
)
router.get(
  '/:id/activities',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.timeline.view'),
  controller.getWorkOrderActivities,
)
router.get(
  '/:id/ledger',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.timeline.view'),
  controller.getWorkOrderLedger,
)

router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.cancel'),
  validateBody(cancelWorkOrderSchema),
  controller.cancelWorkOrder,
)
router.post(
  '/:id/split',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.work_orders.edit', 'manufacturing.work_orders.create'),
  validateBody(splitWorkOrderSchema),
  controller.splitWorkOrder,
)
router.post(
  '/:id/release',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.release'),
  controller.releaseWorkOrder,
)
router.post(
  '/:id/start',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.start'),
  validateBody(startWorkOrderSchema),
  controller.startWorkOrder,
)
router.post(
  '/:id/hold',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.hold'),
  validateBody(holdWorkOrderSchema),
  controller.holdWorkOrder,
)
router.post(
  '/:id/resume',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.work_orders.resume'),
  validateBody(resumeWorkOrderSchema),
  controller.resumeWorkOrder,
)
router.post(
  '/:id/complete',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.production.complete'),
  validateBody(completeWorkOrderSchema),
  controller.completeWorkOrder,
)

router.post(
  '/:id/progress',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.progress.record'),
  validateBody(recordProgressSchema),
  controller.recordProgress,
)
router.post(
  '/:id/stages/complete',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.stage.execute'),
  validateBody(completeStageSchema),
  controller.completeStage,
)
router.post(
  '/:id/progress/correct',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.progress.correct'),
  validateBody(correctProgressSchema),
  controller.correctProgress,
)

export default router
