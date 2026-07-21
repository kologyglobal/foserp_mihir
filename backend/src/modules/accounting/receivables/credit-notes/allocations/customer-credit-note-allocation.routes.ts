import { Router } from 'express'
import { authenticate } from '../../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../../utils/pagination.js'
import * as controller from './customer-credit-note-allocation.controller.js'
import {
  allocateCustomerCreditNoteBodySchema,
  allocateCustomerCreditNotePreviewBodySchema,
  creditNoteAllocationBatchParamSchema,
  creditNoteIdParamSchema,
  listCreditNoteAllocationsQuerySchema,
  reverseCreditNoteAllocationBodySchema,
} from './customer-credit-note-allocation.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.post(
  '/credit-notes/:creditNoteId/allocations/preview',
  validateParams(creditNoteIdParamSchema),
  requirePermission('finance.ar.allocation.view'),
  validateBody(allocateCustomerCreditNotePreviewBodySchema),
  controller.previewCreditNoteAllocation,
)

router.post(
  '/credit-notes/:creditNoteId/allocations',
  validateParams(creditNoteIdParamSchema),
  requirePermission('finance.ar.allocation.create'),
  validateBody(allocateCustomerCreditNoteBodySchema),
  controller.postCreditNoteAllocation,
)

router.post(
  '/credit-notes/:creditNoteId/allocations/:batchId/reverse',
  validateParams(creditNoteAllocationBatchParamSchema),
  requirePermission('finance.ar.allocation.reverse'),
  validateBody(reverseCreditNoteAllocationBodySchema),
  controller.reverseCreditNoteAllocation,
)

router.get(
  '/credit-notes/:creditNoteId/allocations',
  validateParams(creditNoteIdParamSchema),
  requirePermission('finance.ar.allocation.view'),
  validateQuery(listCreditNoteAllocationsQuerySchema),
  controller.getCreditNoteAllocations,
)

export default router
