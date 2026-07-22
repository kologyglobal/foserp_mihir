import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveVendorPaymentSchema,
  cancelVendorPaymentSchema,
  createVendorPaymentSchema,
  listVendorPaymentsQuerySchema,
  markVendorPaymentReadySchema,
  rejectVendorPaymentSchema,
  reviseVendorPaymentSchema,
  submitVendorPaymentSchema,
  updateVendorPaymentSchema,
} from './vendor-payment.schemas.js'
import { postVendorPaymentSchema, reverseVendorPaymentSchema } from './posting/vendor-payment-posting.schemas.js'
import * as controller from './vendor-payment.controller.js'
import * as postingController from './posting/vendor-payment-posting.controller.js'
import * as allocationController from '../allocations/payable-allocation.controller.js'
import {
  allocatableInvoicesQuerySchema,
  createPayableAllocationBodySchema,
  listPayableAllocationsQuerySchema,
} from '../allocations/payable-allocation.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.ap.payment.view'), validateQuery(listVendorPaymentsQuerySchema), controller.listVendorPayments)
router.post('/', requirePermission('finance.ap.payment.create'), validateBody(createVendorPaymentSchema), controller.createVendorPayment)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.view'), controller.getVendorPayment)
router.patch('/:id', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.edit'), validateBody(updateVendorPaymentSchema), controller.updateVendorPayment)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.view'), controller.validateVendorPayment)
router.post('/:id/submit', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.submit'), validateBody(submitVendorPaymentSchema), controller.submitVendorPayment)
router.post('/:id/approve', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.approve'), validateBody(approveVendorPaymentSchema), controller.approveVendorPayment)
router.post('/:id/reject', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.approve'), validateBody(rejectVendorPaymentSchema), controller.rejectVendorPayment)
router.post('/:id/revise', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.edit'), validateBody(reviseVendorPaymentSchema), controller.reviseVendorPayment)
router.post('/:id/mark-ready', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.mark_ready'), validateBody(markVendorPaymentReadySchema), controller.markVendorPaymentReady)
router.post('/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.cancel'), validateBody(cancelVendorPaymentSchema), controller.cancelVendorPayment)
router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.payment.post'),
  validateBody(postVendorPaymentSchema),
  postingController.postVendorPayment,
)
router.get(
  '/:id/reversal-preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.payment.view'),
  postingController.getVendorPaymentReversalPreviewHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.payment.reverse'),
  validateBody(reverseVendorPaymentSchema),
  postingController.reverseVendorPayment,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.ap.payment.view'), controller.getVendorPaymentApproval)

// ─── Phase 4B4 — vendor payment allocation (subledger only, no GL) ────────────
router.get(
  '/:id/allocatable-invoices',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.view'),
  validateQuery(allocatableInvoicesQuerySchema),
  allocationController.getAllocatableInvoices,
)
router.post(
  '/:id/allocations',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.create'),
  validateBody(createPayableAllocationBodySchema),
  allocationController.createVendorPaymentAllocation,
)
router.get(
  '/:id/allocations',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.allocation.view'),
  validateQuery(listPayableAllocationsQuerySchema),
  allocationController.listVendorPaymentAllocations,
)

export default router
