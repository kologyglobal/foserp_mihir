import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import * as controller from './payable-allocation.controller.js'
import { allocationIdParamSchema, reversePayableAllocationBodySchema } from './payable-allocation.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

// GET /accounting/payables/allocations/:allocationId
router.get(
  '/:allocationId',
  validateParams(allocationIdParamSchema),
  requirePermission('finance.ap.allocation.view'),
  controller.getPayableAllocation,
)

// POST /accounting/payables/allocations/:allocationId/reverse
// Subledger-only: restores open-item balances; creates no GL / voucher / PostingEvent.
router.post(
  '/:allocationId/reverse',
  validateParams(allocationIdParamSchema),
  requirePermission('finance.ap.allocation.reverse'),
  validateBody(reversePayableAllocationBodySchema),
  controller.reversePayableAllocationHandler,
)

export default router
