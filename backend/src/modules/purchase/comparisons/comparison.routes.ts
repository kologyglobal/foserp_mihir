import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './comparison.controller.js'
import {
  awardComparisonSchema,
  comparisonListQuerySchema,
  createComparisonSchema,
} from './comparison.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.rfq.compare'),
  validateQuery(comparisonListQuerySchema),
  controller.listComparisons,
)
router.post(
  '/',
  requirePermission('purchase.rfq.compare'),
  validateBody(createComparisonSchema),
  controller.createComparison,
)
router.get(
  '/:id',
  requirePermission('purchase.rfq.compare'),
  validateParams(uuidParamSchema),
  controller.getComparison,
)
router.post(
  '/:id/award',
  requirePermission('purchase.rfq.award'),
  validateParams(uuidParamSchema),
  validateBody(awardComparisonSchema),
  controller.awardComparison,
)
router.post(
  '/:id/create-po',
  requirePermission('purchase.rfq.convert_to_po'),
  validateParams(uuidParamSchema),
  controller.createPurchaseOrder,
)

export default router
