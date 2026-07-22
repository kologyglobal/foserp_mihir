import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './bank-reconciliation-profile.controller.js'
import { updateBankReconciliationProfileSchema } from './bank-reconciliation-profile.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/:id/reconciliation-profile',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.reconciliation_settings.view'),
  controller.getBankReconciliationProfile,
)

router.put(
  '/:id/reconciliation-profile',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.reconciliation_settings.manage'),
  validateBody(updateBankReconciliationProfileSchema),
  controller.putBankReconciliationProfile,
)

export default router
