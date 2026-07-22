import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { z } from 'zod'
import * as controller from './correction.controller.js'
import {
  applyCorrectionSchema,
  cancelCorrectionSchema,
  createCorrectionSchema,
  listCorrectionsQuerySchema,
  previewCorrectionSchema,
  rejectCorrectionSchema,
  updateCorrectionSchema,
} from './correction.schemas.js'

const correctionIdSchema = z.object({ correctionId: z.string().uuid() })
const historyParamsSchema = z.object({
  entityType: z.string().min(1).max(64),
  entityId: z.string().uuid(),
})

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
  requirePermission('manufacturing.correction.view'),
  validateQuery(listCorrectionsQuerySchema),
  controller.list,
)
router.post(
  '/preview',
  requirePermission('manufacturing.correction.request'),
  validateBody(previewCorrectionSchema),
  controller.preview,
)
router.post(
  '/',
  requirePermission('manufacturing.correction.request'),
  validateBody(createCorrectionSchema),
  controller.create,
)

router.get(
  '/transactions/:entityType/:entityId/correction-history',
  requirePermission('manufacturing.correction.view'),
  validateParams(historyParamsSchema),
  controller.history,
)

router.get(
  '/:correctionId',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.view'),
  controller.get,
)
router.patch(
  '/:correctionId',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.request'),
  validateBody(updateCorrectionSchema),
  controller.update,
)
router.post(
  '/:correctionId/validate',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.request'),
  async (req, res, next) => {
    // validate = re-preview using stored values
    try {
      const existing = await import('./correction.service.js').then((m) =>
        m.get(req.context!.tenantId!, req.params.correctionId as string),
      )
      const preview = await import('./correction.service.js').then((m) =>
        m.preview(req, req.context!.tenantId!, {
          transactionType: existing.transactionType as never,
          correctionType: existing.correctionType as never,
          sourceEntityType: existing.sourceEntityType,
          sourceEntityId: existing.sourceEntityId,
          productionOrderId: existing.productionOrderId ?? undefined,
          requestedAction: existing.requestedAction,
          requestedValues: (existing.requestedValues as Record<string, unknown>) ?? undefined,
        }),
      )
      res.json({ success: true, message: 'Correction validated', data: preview })
    } catch (e) {
      next(e)
    }
  },
)
router.post(
  '/:correctionId/submit',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.request'),
  controller.submit,
)
router.post(
  '/:correctionId/approve',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.approve'),
  controller.approve,
)
router.post(
  '/:correctionId/reject',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.reject'),
  validateBody(rejectCorrectionSchema),
  controller.reject,
)
router.post(
  '/:correctionId/apply',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.apply'),
  validateBody(applyCorrectionSchema),
  controller.apply,
)
router.post(
  '/:correctionId/cancel',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.request'),
  validateBody(cancelCorrectionSchema),
  controller.cancel,
)
router.get(
  '/:correctionId/dependencies',
  validateParams(correctionIdSchema),
  requirePermission('manufacturing.correction.view'),
  controller.dependencies,
)

export default router

// silence unused import from shared uuid schema (parent may reuse)
void uuidParamSchema
