import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveVendorInvoiceSchema,
  cancelVendorInvoiceSchema,
  createVendorInvoiceSchema,
  listVendorInvoicesQuerySchema,
  markVendorInvoiceReadySchema,
  rejectVendorInvoiceSchema,
  reviseVendorInvoiceSchema,
  submitVendorInvoiceSchema,
  updateVendorInvoiceSchema,
} from './vendor-invoice.schemas.js'
import { postVendorInvoiceSchema, reverseVendorInvoiceSchema } from './posting/vendor-invoice-posting.schemas.js'
import * as controller from './vendor-invoice.controller.js'
import * as postingController from './posting/vendor-invoice-posting.controller.js'
import * as allocationController from '../allocations/payable-allocation.controller.js'
import { listPayableAllocationsQuerySchema } from '../allocations/payable-allocation.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.ap.vendor_invoice.view'), validateQuery(listVendorInvoicesQuerySchema), controller.listVendorInvoices)
router.post('/', requirePermission('finance.ap.vendor_invoice.create'), validateBody(createVendorInvoiceSchema), controller.createVendorInvoice)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.view'), controller.getVendorInvoice)
router.patch('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.edit'), validateBody(updateVendorInvoiceSchema), controller.updateVendorInvoice)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.view'), controller.validateVendorInvoice)
router.post('/:id/submit', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.submit'), validateBody(submitVendorInvoiceSchema), controller.submitVendorInvoice)
router.post('/:id/approve', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.approve'), validateBody(approveVendorInvoiceSchema), controller.approveVendorInvoice)
router.post('/:id/reject', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.approve'), validateBody(rejectVendorInvoiceSchema), controller.rejectVendorInvoice)
router.post('/:id/revise', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.edit'), validateBody(reviseVendorInvoiceSchema), controller.reviseVendorInvoice)
router.post('/:id/mark-ready', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.mark_ready'), validateBody(markVendorInvoiceReadySchema), controller.markVendorInvoiceReady)
router.post('/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.cancel'), validateBody(cancelVendorInvoiceSchema), controller.cancelVendorInvoice)
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.vendor_invoice.post'),
  validateBody(postVendorInvoiceSchema),
  postingController.postVendorInvoice,
)
router.get(
  '/:id/reversal-preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.vendor_invoice.view'),
  postingController.getVendorInvoiceReversalPreviewHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.vendor_invoice.reverse'),
  validateBody(reverseVendorInvoiceSchema),
  postingController.reverseVendorInvoice,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.ap.vendor_invoice.view'), controller.getVendorInvoiceApproval)

// ─── Phase 4B4 — allocations applied to this vendor invoice (subledger only) ──
router.get(
  '/:id/allocations',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.view'),
  validateQuery(listPayableAllocationsQuerySchema),
  allocationController.listVendorInvoiceAllocations,
)

export default router
