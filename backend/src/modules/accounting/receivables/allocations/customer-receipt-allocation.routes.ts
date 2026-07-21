import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import * as controller from './customer-receipt-allocation.controller.js'
import {
  allocateCustomerReceiptBodySchema,
  allocateCustomerReceiptPreviewBodySchema,
  invoiceIdParamSchema,
  listCustomerCreditsQuerySchema,
  listReceiptAllocationsQuerySchema,
  receiptAllocationBatchParamSchema,
  receiptIdParamSchema,
  reverseAllocationBodySchema,
} from './customer-receipt-allocation.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/customer-credits',
  requirePermission('finance.ar.view'),
  validateQuery(listCustomerCreditsQuerySchema),
  controller.getCustomerCredits,
)

router.post(
  '/receipts/:receiptId/allocations/preview',
  validateParams(receiptIdParamSchema),
  requirePermission('finance.ar.allocation.view'),
  validateBody(allocateCustomerReceiptPreviewBodySchema),
  controller.previewReceiptAllocation,
)

router.post(
  '/receipts/:receiptId/allocations',
  validateParams(receiptIdParamSchema),
  requirePermission('finance.ar.allocation.create'),
  validateBody(allocateCustomerReceiptBodySchema),
  controller.postReceiptAllocation,
)

router.post(
  '/receipts/:receiptId/allocations/:batchId/reverse',
  validateParams(receiptAllocationBatchParamSchema),
  requirePermission('finance.ar.allocation.reverse'),
  validateBody(reverseAllocationBodySchema),
  controller.reverseReceiptAllocation,
)

router.get(
  '/receipts/:receiptId/allocations',
  validateParams(receiptIdParamSchema),
  requirePermission('finance.ar.allocation.view'),
  validateQuery(listReceiptAllocationsQuerySchema),
  controller.getReceiptAllocations,
)

router.get(
  '/invoices/:invoiceId/allocations',
  validateParams(invoiceIdParamSchema),
  requirePermission('finance.ar.allocation.view'),
  validateQuery(listReceiptAllocationsQuerySchema),
  controller.getInvoiceAllocations,
)

export default router
