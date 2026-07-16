import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './quotation.controller.js'
import {
  approvalRemarksSchema,
  createQuotationSchema,
  listQuotationsQuerySchema,
  quotationDocumentParamsSchema,
  revisionReasonSchema,
  updateQuotationDocumentSchema,
  updateQuotationSchema,
} from './quotation.validation.js'
import { convertQuotationToSalesOrderSchema } from '../sales-orders/sales-order.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.quotation.view'), validateQuery(listQuotationsQuerySchema), controller.listQuotations)
router.post('/', requirePermission('crm.quotation.create'), validateBody(createQuotationSchema), controller.createQuotation)
router.get('/:id', requirePermission('crm.quotation.view'), validateParams(uuidParamSchema), controller.getQuotation)
router.patch('/:id', requirePermission('crm.quotation.update'), validateParams(uuidParamSchema), validateBody(updateQuotationSchema), controller.updateQuotation)
router.delete('/:id', requirePermission('crm.quotation.delete'), validateParams(uuidParamSchema), controller.deleteQuotation)
router.post('/:id/revisions', requirePermission('crm.quotation.update'), validateParams(uuidParamSchema), validateBody(revisionReasonSchema), controller.createQuotationRevision)

router.patch(
  '/:id/documents/:docId',
  requirePermission('crm.quotation.update'),
  validateParams(quotationDocumentParamsSchema),
  validateBody(updateQuotationDocumentSchema),
  controller.updateQuotationDocument,
)
router.post(
  '/:id/documents/:docId/submit-approval',
  requirePermission('crm.quotation.update'),
  validateParams(quotationDocumentParamsSchema),
  validateBody(approvalRemarksSchema),
  controller.submitDocumentForApproval,
)
router.post(
  '/:id/documents/:docId/approve',
  requirePermission('crm.quotation.approve'),
  validateParams(quotationDocumentParamsSchema),
  validateBody(approvalRemarksSchema),
  controller.approveDocument,
)
router.post(
  '/:id/documents/:docId/reject',
  requirePermission('crm.quotation.approve'),
  validateParams(quotationDocumentParamsSchema),
  validateBody(approvalRemarksSchema),
  controller.rejectDocument,
)
router.post(
  '/:id/documents/:docId/mark-sent',
  requirePermission('crm.quotation.update'),
  validateParams(quotationDocumentParamsSchema),
  controller.markDocumentSent,
)
router.post(
  '/:id/convert-to-sales-order',
  requirePermission('crm.quotation.update'),
  validateParams(uuidParamSchema),
  validateBody(convertQuotationToSalesOrderSchema),
  controller.convertQuotationToSalesOrder,
)

export default router
