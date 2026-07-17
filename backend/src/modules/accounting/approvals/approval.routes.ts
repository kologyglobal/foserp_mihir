import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { listApprovalRequestsQuerySchema } from './approval.schemas.js'
import * as controller from './approval.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requireAnyPermission('finance.voucher.approve', 'finance.voucher.view', 'finance.audit.view'),
  validateQuery(listApprovalRequestsQuerySchema),
  controller.listApprovalRequests,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requireAnyPermission('finance.voucher.approve', 'finance.voucher.view', 'finance.audit.view'),
  controller.getApprovalRequest,
)

export default router
