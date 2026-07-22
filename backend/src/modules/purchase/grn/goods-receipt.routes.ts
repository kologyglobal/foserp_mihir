import { Router } from 'express'
import {
  requireAnyPermission,
  requirePermission,
} from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './goods-receipt.controller.js'
import {
  createGoodsReceiptSchema,
  grnLifecycleRemarksSchema,
  listGoodsReceiptsQuerySchema,
  updateGoodsReceiptSchema,
} from './goods-receipt.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.grn.view'),
  validateQuery(listGoodsReceiptsQuerySchema),
  controller.listGoodsReceipts,
)

router.post(
  '/',
  requirePermission('purchase.grn.create'),
  validateBody(createGoodsReceiptSchema),
  controller.createGoodsReceipt,
)

router.get(
  '/next-number',
  requirePermission('purchase.grn.create'),
  controller.previewNextGoodsReceiptNumber,
)

router.get(
  '/:id',
  requirePermission('purchase.grn.view'),
  validateParams(uuidParamSchema),
  controller.getGoodsReceipt,
)

router.patch(
  '/:id',
  requirePermission('purchase.grn.create'),
  validateParams(uuidParamSchema),
  validateBody(updateGoodsReceiptSchema),
  controller.updateGoodsReceipt,
)

router.post(
  '/:id/submit',
  requireAnyPermission('purchase.grn.create', 'purchase.grn.post'),
  validateParams(uuidParamSchema),
  validateBody(grnLifecycleRemarksSchema),
  controller.submitGoodsReceipt,
)

router.post(
  '/:id/cancel',
  requirePermission('purchase.grn.create'),
  validateParams(uuidParamSchema),
  validateBody(grnLifecycleRemarksSchema),
  controller.cancelGoodsReceipt,
)

router.post(
  '/:id/reverse',
  requirePermission('purchase.grn.post'),
  validateParams(uuidParamSchema),
  validateBody(grnLifecycleRemarksSchema),
  controller.reverseGoodsReceipt,
)

router.post(
  '/:id/post-inventory',
  requirePermission('purchase.grn.post'),
  validateParams(uuidParamSchema),
  validateBody(grnLifecycleRemarksSchema),
  controller.postInventoryGoodsReceipt,
)

export default router
