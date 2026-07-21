import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-planning.controller.js'
import {
  bulkAssignBuyerSchema,
  bulkSelectVendorSchema,
  bulkStatusSchema,
  listPlanningSheetQuerySchema,
  recalculatePlanningSchema,
  updatePlanningRowSchema,
  createPoFromPlanningSchema,
} from './purchase-planning.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.planning.view'),
  validateQuery(listPlanningSheetQuerySchema),
  controller.listPlanningSheet,
)

router.get(
  '/summary',
  requirePermission('purchase.planning.view'),
  controller.getPlanningSheetSummary,
)

router.post(
  '/bulk-assign-buyer',
  requirePermission('purchase.planning.assign_buyer'),
  validateBody(bulkAssignBuyerSchema),
  controller.bulkAssignBuyer,
)

router.post(
  '/bulk-select-vendor',
  requirePermission('purchase.planning.select_vendor'),
  validateBody(bulkSelectVendorSchema),
  controller.bulkSelectVendor,
)

router.post(
  '/bulk-status',
  requireAnyPermission(
    'purchase.planning.edit',
    'purchase.planning.approve',
    'purchase.planning.cancel',
  ),
  validateBody(bulkStatusSchema),
  controller.bulkUpdateStatus,
)

router.post(
  '/recalculate',
  requirePermission('purchase.planning.edit'),
  validateBody(recalculatePlanningSchema),
  controller.recalculatePlanningRows,
)

router.post(
  '/create-po',
  requirePermission('purchase.planning.create_po'),
  validateBody(createPoFromPlanningSchema),
  controller.createPurchaseOrdersFromPlanning,
)

router.get(
  '/:id',
  requirePermission('purchase.planning.view'),
  validateParams(uuidParamSchema),
  controller.getPlanningRow,
)

router.patch(
  '/:id',
  requireAnyPermission(
    'purchase.planning.edit',
    'purchase.planning.approve',
    'purchase.planning.cancel',
    'purchase.planning.assign_buyer',
    'purchase.planning.select_vendor',
  ),
  validateParams(uuidParamSchema),
  validateBody(updatePlanningRowSchema),
  controller.updatePlanningRow,
)

export default router
