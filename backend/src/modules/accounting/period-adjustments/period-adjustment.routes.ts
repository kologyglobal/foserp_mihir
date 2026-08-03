import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  cancelPeriodAdjustmentSchema,
  createPeriodAdjustmentSchema,
  listPeriodAdjustmentsQuerySchema,
  reversePeriodAdjustmentSchema,
  updatePeriodAdjustmentSchema,
} from './period-adjustment.schemas.js'
import * as controller from './period-adjustment.controller.js'

const periodParamSchema = z.object({ periodId: z.string().uuid() })
const scheduleParamSchema = z.object({ id: z.string().uuid(), scheduleId: z.string().uuid() })
const bulkReverseSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() })

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requirePermission('finance.period_adjustment.view'),
  validateQuery(listPeriodAdjustmentsQuerySchema),
  controller.listPeriodAdjustments,
)
router.post(
  '/',
  requirePermission('finance.period_adjustment.manage'),
  validateBody(createPeriodAdjustmentSchema),
  controller.createPeriodAdjustment,
)

router.get(
  '/periods/:periodId/summary',
  validateParams(periodParamSchema),
  requirePermission('finance.period_adjustment.view'),
  controller.getPeriodAdjustmentSummary,
)
router.post(
  '/periods/:periodId/recognise-due-prepaid',
  validateParams(periodParamSchema),
  requirePermission('finance.period_adjustment.post'),
  controller.recogniseDuePrepaidForPeriod,
)
router.post(
  '/periods/:periodId/reverse-due-accruals',
  validateParams(periodParamSchema),
  requirePermission('finance.period_adjustment.reverse'),
  validateBody(bulkReverseSchema),
  controller.reverseDueAccrualsForPeriod,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.view'),
  controller.getPeriodAdjustment,
)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.manage'),
  validateBody(updatePeriodAdjustmentSchema),
  controller.updatePeriodAdjustment,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.manage'),
  controller.markPeriodAdjustmentReady,
)
router.post(
  '/:id/revise',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.manage'),
  controller.revisePeriodAdjustment,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.manage'),
  validateBody(cancelPeriodAdjustmentSchema),
  controller.cancelPeriodAdjustment,
)
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.post'),
  controller.postPeriodAdjustment,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.period_adjustment.reverse'),
  validateBody(reversePeriodAdjustmentSchema),
  controller.reversePeriodAdjustment,
)
router.post(
  '/:id/schedules/:scheduleId/recognise',
  validateParams(scheduleParamSchema),
  requirePermission('finance.period_adjustment.post'),
  controller.recognisePrepaidSchedule,
)

export default router
