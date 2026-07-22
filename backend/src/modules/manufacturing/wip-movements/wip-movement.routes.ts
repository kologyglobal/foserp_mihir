import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './wip-movement.controller.js'
import {
  createWipMovementSchema,
  listWipMovementsQuerySchema,
  transferToWorkOrderSchema,
} from './wip-movement.schemas.js'

/**
 * Nested under `/work-orders/:id`. Param `id` is the work order id (mergeParams).
 * Do not re-run tenantRouteParamSchema here — it would strip `id`.
 */
const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('manufacturing.wip.move'),
  validateQuery(listWipMovementsQuerySchema),
  controller.list,
)

router.get('/:movementId', requirePermission('manufacturing.wip.move'), controller.get)

router.post(
  '/',
  requirePermission('manufacturing.wip.move'),
  validateBody(createWipMovementSchema),
  controller.create,
)

export default router

/** Mounted separately: POST /work-orders/:id/transfer-to/:targetId */
export const transferToRouter = Router({ mergeParams: true })
transferToRouter.post(
  '/',
  requirePermission('manufacturing.materials.transfer'),
  validateBody(transferToWorkOrderSchema),
  controller.transferTo,
)
