import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './rfq.controller.js'
import {
  createRfqSchema,
  lifecycleRemarksSchema,
  listRfqsQuerySchema,
  setRfqVendorsSchema,
  updateRfqSchema,
} from './rfq.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.rfq.view'),
  validateQuery(listRfqsQuerySchema),
  controller.listRfqs,
)

router.post(
  '/',
  requirePermission('purchase.rfq.create'),
  validateBody(createRfqSchema),
  controller.createRfq,
)

router.get(
  '/next-number',
  requirePermission('purchase.rfq.create'),
  controller.previewNextRfqNumber,
)

router.get(
  '/:id',
  requirePermission('purchase.rfq.view'),
  validateParams(uuidParamSchema),
  controller.getRfq,
)

router.patch(
  '/:id',
  requirePermission('purchase.rfq.create'),
  validateParams(uuidParamSchema),
  validateBody(updateRfqSchema),
  controller.updateRfq,
)

router.post(
  '/:id/vendors',
  requirePermission('purchase.rfq.create'),
  validateParams(uuidParamSchema),
  validateBody(setRfqVendorsSchema),
  controller.setRfqVendors,
)

router.post(
  '/:id/send',
  requirePermission('purchase.rfq.send'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.sendRfq,
)

router.post(
  '/:id/cancel',
  requirePermission('purchase.rfq.create'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.cancelRfq,
)

export default router
