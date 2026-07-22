import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-invoice.controller.js'
import {
  createPurchaseInvoiceSchema, invoiceLifecycleSchema, listPurchaseInvoicesQuerySchema, updatePurchaseInvoiceSchema,
} from './purchase-invoice.validation.js'

const router = Router({ mergeParams: true })
router.get('/', requirePermission('purchase.invoice.view'), validateQuery(listPurchaseInvoicesQuerySchema), controller.listPurchaseInvoices)
router.post('/', requirePermission('purchase.invoice.create'), validateBody(createPurchaseInvoiceSchema), controller.createPurchaseInvoice)
router.get('/:id', requirePermission('purchase.invoice.view'), validateParams(uuidParamSchema), controller.getPurchaseInvoice)
router.get(
  '/:id/ap-handoff-preview',
  requirePermission('purchase.invoice.view'),
  validateParams(uuidParamSchema),
  controller.previewPurchaseInvoiceApHandoff,
)
router.patch('/:id', requirePermission('purchase.invoice.edit'), validateParams(uuidParamSchema), validateBody(updatePurchaseInvoiceSchema), controller.updatePurchaseInvoice)
router.post('/:id/submit', requirePermission('purchase.invoice.submit'), validateParams(uuidParamSchema), validateBody(invoiceLifecycleSchema), controller.submitPurchaseInvoice)
router.post('/:id/approve', requirePermission('purchase.invoice.approve'), validateParams(uuidParamSchema), validateBody(invoiceLifecycleSchema), controller.approvePurchaseInvoice)
router.post('/:id/reject', requirePermission('purchase.invoice.approve'), validateParams(uuidParamSchema), validateBody(invoiceLifecycleSchema), controller.rejectPurchaseInvoice)
router.post('/:id/post', requirePermission('purchase.invoice.post'), validateParams(uuidParamSchema), validateBody(invoiceLifecycleSchema), controller.postPurchaseInvoice)
router.post('/:id/cancel', requirePermission('purchase.invoice.cancel'), validateParams(uuidParamSchema), validateBody(invoiceLifecycleSchema), controller.cancelPurchaseInvoice)
export default router
