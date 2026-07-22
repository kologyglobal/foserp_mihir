import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { z } from 'zod'
import * as controller from './daily-production.controller.js'
import {
  correctDailyLineSchema,
  createDailyBatchSchema,
  listDailyBatchesQuerySchema,
  updateDailyBatchSchema,
  upsertDailyLineSchema,
} from './daily-production.schemas.js'

const batchLineParamSchema = uuidParamSchema.extend({ lineId: z.string().uuid() })

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.daily_production.view'),
  validateQuery(listDailyBatchesQuerySchema),
  controller.listBatches,
)
router.post(
  '/',
  requirePermission('manufacturing.daily_production.create'),
  validateBody(createDailyBatchSchema),
  controller.createBatch,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.daily_production.view'), controller.getBatch)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.daily_production.create'),
  validateBody(updateDailyBatchSchema),
  controller.updateBatch,
)
router.post(
  '/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.daily_production.create'),
  validateBody(upsertDailyLineSchema),
  controller.addLine,
)
router.patch(
  '/:id/lines/:lineId',
  validateParams(batchLineParamSchema),
  requirePermission('manufacturing.daily_production.create'),
  validateBody(upsertDailyLineSchema),
  controller.updateLine,
)
router.delete(
  '/:id/lines/:lineId',
  validateParams(batchLineParamSchema),
  requirePermission('manufacturing.daily_production.create'),
  controller.removeLine,
)
router.post(
  '/:id/validate',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.daily_production.submit'),
  controller.validateBatch,
)
router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.daily_production.submit'),
  controller.submitBatch,
)
router.post(
  '/:id/lines/:lineId/correct',
  validateParams(batchLineParamSchema),
  requirePermission('manufacturing.progress.correct'),
  validateBody(correctDailyLineSchema),
  controller.correctLine,
)

export default router
