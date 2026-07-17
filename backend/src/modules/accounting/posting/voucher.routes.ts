import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from '../ledger/ledger.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.voucher.view'),
  controller.getVoucher,
)

router.get(
  '/:id/ledger',
  validateParams(uuidParamSchema),
  requirePermission('finance.gl.view'),
  controller.getVoucherLedger,
)

export default router
