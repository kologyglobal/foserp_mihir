import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission, requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { z } from 'zod'
import { decideInspectionSchema } from '../inspections/inspection.schemas.js'
import * as inspectionService from '../inspections/inspection.service.js'
import * as service from './kiosk.service.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

const queueQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  category: z.enum(['INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN']).optional(),
  productionOrderId: z.string().uuid().optional(),
})

/** GET /quality/kiosk/queue — pending + rework inspections for QC kiosk. */
router.get(
  '/queue',
  requirePermission('quality.view'),
  validateQuery(queueQuerySchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const result = await service.listQcKioskQueue(tenantId, req.query as never)
    return sendSuccess(res, 'QC kiosk queue listed', result)
  }),
)

/** GET /quality/kiosk/summary */
router.get(
  '/summary',
  requirePermission('quality.view'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const result = await service.listQcKioskQueue(tenantId, { limit: 100 })
    return sendSuccess(res, 'QC kiosk summary', result.summary)
  }),
)

/** GET /quality/kiosk/inspections/:id */
router.get(
  '/inspections/:id',
  validateParams(uuidParamSchema),
  requirePermission('quality.view'),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const id = getRouteParam(req, 'id')
    const item = await service.getQcKioskInspection(tenantId, id)
    return sendSuccess(res, 'QC kiosk inspection fetched', item)
  }),
)

/**
 * POST /quality/kiosk/inspections/:id/decide
 * Same decide contract as /quality/inspections/:id/decide — convenience for mobile kiosk.
 */
router.post(
  '/inspections/:id/decide',
  validateParams(uuidParamSchema),
  requireAnyPermission('quality.submit', 'manufacturing.quality.inspect'),
  validateBody(decideInspectionSchema),
  asyncHandler(async (req, res) => {
    const tenantId = getTenantId(req)
    const id = getRouteParam(req, 'id')
    const result = await inspectionService.decideInspection(req, tenantId, id, req.body)
    return sendSuccess(res, 'Inspection decided', result)
  }),
)

export default router
