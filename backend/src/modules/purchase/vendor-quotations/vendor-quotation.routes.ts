import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './vendor-quotation.controller.js'
import {
  createVendorQuotationSchema,
  lifecycleRemarksSchema,
  listVendorQuotationsQuerySchema,
  updateVendorQuotationSchema,
} from './vendor-quotation.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.rfq.view'),
  validateQuery(listVendorQuotationsQuerySchema),
  controller.listVendorQuotations,
)

router.post(
  '/',
  requirePermission('purchase.rfq.enter_quote'),
  validateBody(createVendorQuotationSchema),
  controller.createVendorQuotation,
)

router.get(
  '/next-number',
  requirePermission('purchase.rfq.enter_quote'),
  controller.previewNextVendorQuotationNumber,
)

router.get(
  '/:id',
  requirePermission('purchase.rfq.view'),
  validateParams(uuidParamSchema),
  controller.getVendorQuotation,
)

router.patch(
  '/:id',
  requirePermission('purchase.rfq.enter_quote'),
  validateParams(uuidParamSchema),
  validateBody(updateVendorQuotationSchema),
  controller.updateVendorQuotation,
)

router.post(
  '/:id/submit',
  requirePermission('purchase.rfq.enter_quote'),
  validateParams(uuidParamSchema),
  validateBody(lifecycleRemarksSchema),
  controller.submitVendorQuotation,
)

export default router
