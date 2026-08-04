import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './quality-inspection.controller.js'
import {
  assignQualityInspectorSchema,
  completeQualityInspectionSchema,
  createNcrFromQiSchema,
  createQualityInspectionSchema,
  listQualityInspectionsQuerySchema,
  qualityInspectionRemarksSchema,
  updateQualityInspectionSchema,
} from './quality-inspection.validation.js'

const router = Router({ mergeParams: true })
router.get('/', requirePermission('purchase.qi.view'), validateQuery(listQualityInspectionsQuerySchema), controller.listQualityInspections)
router.post('/', requirePermission('purchase.qi.create'), validateBody(createQualityInspectionSchema), controller.createQualityInspection)
router.get('/:id', requirePermission('purchase.qi.view'), validateParams(uuidParamSchema), controller.getQualityInspection)
router.get('/:id/stock-status', requirePermission('purchase.qi.view'), validateParams(uuidParamSchema), controller.getQiStockStatus)
router.get(
  '/:id/purchase-return-prefill',
  requirePermission('purchase.return.create'),
  validateParams(uuidParamSchema),
  controller.getPurchaseReturnPrefill,
)
router.patch(
  '/:id',
  requirePermission('purchase.qi.edit'),
  validateParams(uuidParamSchema),
  validateBody(updateQualityInspectionSchema),
  controller.updateQualityInspection,
)
router.post(
  '/:id/assign',
  requirePermission('purchase.qi.edit'),
  validateParams(uuidParamSchema),
  validateBody(assignQualityInspectorSchema),
  controller.assignQualityInspector,
)
router.post('/:id/start', requirePermission('purchase.qi.edit'), validateParams(uuidParamSchema), controller.startQualityInspection)
router.post(
  '/:id/complete',
  requirePermission('purchase.qi.complete'),
  validateParams(uuidParamSchema),
  validateBody(completeQualityInspectionSchema),
  controller.completeQualityInspection,
)
router.post(
  '/:id/accept',
  requirePermission('purchase.qi.complete'),
  validateParams(uuidParamSchema),
  validateBody(qualityInspectionRemarksSchema),
  controller.acceptQualityInspection,
)
router.post(
  '/:id/reject',
  requirePermission('purchase.qi.complete'),
  validateParams(uuidParamSchema),
  validateBody(qualityInspectionRemarksSchema),
  controller.rejectQualityInspection,
)
router.post(
  '/:id/hold',
  requirePermission('purchase.qi.edit'),
  validateParams(uuidParamSchema),
  validateBody(qualityInspectionRemarksSchema),
  controller.holdQualityInspection,
)
router.post(
  '/:id/cancel',
  requirePermission('purchase.qi.cancel'),
  validateParams(uuidParamSchema),
  validateBody(qualityInspectionRemarksSchema),
  controller.cancelQualityInspection,
)
router.post(
  '/:id/ncr',
  requireAnyPermission('quality.create', 'purchase.qi.complete'),
  validateParams(uuidParamSchema),
  validateBody(createNcrFromQiSchema),
  controller.createNcrFromQi,
)
export default router
