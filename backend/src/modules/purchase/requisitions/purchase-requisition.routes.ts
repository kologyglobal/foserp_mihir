import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-requisition.controller.js'
import { convertPrToRfqSchema } from '../rfq/rfq.validation.js'
import {
  createPurchaseRequisitionSchema,
  lifecycleRemarksSchema,
  listPurchaseRequisitionsQuerySchema,
  rejectPurchaseRequisitionSchema,
  sendBackPurchaseRequisitionSchema,
  updatePurchaseRequisitionSchema,
} from './purchase-requisition.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.pr.view'),
  validateQuery(listPurchaseRequisitionsQuerySchema),
  controller.listPurchaseRequisitions,
)

router.post(
  '/',
  requirePermission('purchase.pr.create'),
  validateBody(createPurchaseRequisitionSchema),
  controller.createPurchaseRequisition,
)

router.get(
  '/next-number',
  requirePermission('purchase.pr.create'),
  controller.previewNextPurchaseRequisitionNumber,
)

router.get(
  '/:id',
  requirePermission('purchase.pr.view'),
  validateParams(uuidParamSchema),
  controller.getPurchaseRequisition,
)

router.patch(
  '/:id',
  requirePermission('purchase.pr.edit'),
  validateParams(uuidParamSchema),
  validateBody(updatePurchaseRequisitionSchema),
  controller.updatePurchaseRequisition,
)

router.post(
  '/:id/submit',
  requirePermission('purchase.pr.submit'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.submitPurchaseRequisition,
)

router.post(
  '/:id/approve',
  requirePermission('purchase.pr.approve'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.approvePurchaseRequisition,
)

router.post(
  '/:id/reject',
  requirePermission('purchase.pr.reject'),
  validateParams(uuidParamSchema),
  validateBody(rejectPurchaseRequisitionSchema),
  controller.rejectPurchaseRequisition,
)

router.post(
  '/:id/send-back',
  requirePermission('purchase.pr.approve'),
  validateParams(uuidParamSchema),
  validateBody(sendBackPurchaseRequisitionSchema),
  controller.sendBackPurchaseRequisition,
)

router.post(
  '/:id/cancel',
  requirePermission('purchase.pr.cancel'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.cancelPurchaseRequisition,
)

router.post(
  '/:id/reopen',
  requirePermission('purchase.pr.reopen'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.reopenPurchaseRequisition,
)

router.post(
  '/:id/convert-to-rfq',
  requirePermission('purchase.rfq.create'),
  validateParams(uuidParamSchema),
  validateBody(convertPrToRfqSchema),
  controller.convertPrToRfq,
)

export default router
