import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './commercial.controller.js'
import {
  allocatePaymentsSchema,
  createInvoiceSchema,
  createReceiptSchema,
  listAllocationsQuerySchema,
  listInvoicesQuerySchema,
  listReceiptsQuerySchema,
} from './commercial.validation.js'

const router = Router({ mergeParams: true })

router.get('/sync', requirePermission('crm.commercial.view'), controller.syncBundle)

router.get('/receipts', requirePermission('crm.commercial.receipt.view'), validateQuery(listReceiptsQuerySchema), controller.listReceipts)
router.post('/receipts', requirePermission('crm.commercial.receipt.create'), validateBody(createReceiptSchema), controller.createReceipt)
router.get('/receipts/:id', requirePermission('crm.commercial.receipt.view'), validateParams(uuidParamSchema), controller.getReceipt)

router.get('/invoices', requirePermission('crm.commercial.invoice.view'), validateQuery(listInvoicesQuerySchema), controller.listInvoices)
router.post('/invoices', requirePermission('crm.commercial.invoice.create'), validateBody(createInvoiceSchema), controller.createInvoice)
router.get('/invoices/:id', requirePermission('crm.commercial.invoice.view'), validateParams(uuidParamSchema), controller.getInvoice)
router.post('/invoices/:id/post', requirePermission('crm.commercial.invoice.post'), validateParams(uuidParamSchema), controller.postInvoice)
router.post('/invoices/:id/cancel', requirePermission('crm.commercial.invoice.cancel'), validateParams(uuidParamSchema), controller.cancelInvoice)

router.get('/allocations', requirePermission('crm.commercial.allocation.view'), validateQuery(listAllocationsQuerySchema), controller.listAllocations)
router.post('/allocations', requirePermission('crm.commercial.allocation.create'), validateBody(allocatePaymentsSchema), controller.allocatePayments)
router.post('/allocations/:id/reverse', requirePermission('crm.commercial.allocation.reverse'), validateParams(uuidParamSchema), controller.reverseAllocation)

export default router
