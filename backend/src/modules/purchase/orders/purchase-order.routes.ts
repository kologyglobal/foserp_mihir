import { Router } from 'express'
import {
  requireAnyPermission,
  requirePermission,
} from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-order.controller.js'
import {
  createPurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
  poLifecycleRemarksSchema,
  poReasonSchema,
  updatePurchaseOrderSchema,
} from './purchase-order.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.po.view'),
  validateQuery(listPurchaseOrdersQuerySchema),
  controller.listPurchaseOrders,
)

router.post(
  '/',
  requirePermission('purchase.po.create'),
  validateBody(createPurchaseOrderSchema),
  controller.createPurchaseOrder,
)

router.get(
  '/next-number',
  requirePermission('purchase.po.create'),
  controller.previewNextPurchaseOrderNumber,
)

router.get(
  '/:id',
  requirePermission('purchase.po.view'),
  validateParams(uuidParamSchema),
  controller.getPurchaseOrder,
)

router.patch(
  '/:id',
  requirePermission('purchase.po.edit'),
  validateParams(uuidParamSchema),
  validateBody(updatePurchaseOrderSchema),
  controller.updatePurchaseOrder,
)

router.post(
  '/:id/submit',
  requireAnyPermission('purchase.po.create', 'purchase.po.edit'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.submitPurchaseOrder,
)

router.post(
  '/:id/approve',
  requirePermission('purchase.po.approve'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.approvePurchaseOrder,
)

router.post(
  '/:id/reject',
  requirePermission('purchase.po.approve'),
  validateParams(uuidParamSchema),
  validateBody(poReasonSchema),
  controller.rejectPurchaseOrder,
)

router.post(
  '/:id/send-back',
  requirePermission('purchase.po.approve'),
  validateParams(uuidParamSchema),
  validateBody(poReasonSchema),
  controller.sendBackPurchaseOrder,
)

router.post(
  '/:id/send-to-vendor',
  requirePermission('purchase.po.send'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.sendPurchaseOrderToVendor,
)

router.post(
  '/:id/cancel',
  requirePermission('purchase.po.cancel'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.cancelPurchaseOrder,
)

router.post(
  '/:id/close',
  requirePermission('purchase.po.close'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.closePurchaseOrder,
)

router.post(
  '/:id/reopen',
  requireAnyPermission('purchase.po.edit', 'purchase.po.approve'),
  validateParams(uuidParamSchema),
  validateBody(poLifecycleRemarksSchema),
  controller.reopenPurchaseOrder,
)

export default router
