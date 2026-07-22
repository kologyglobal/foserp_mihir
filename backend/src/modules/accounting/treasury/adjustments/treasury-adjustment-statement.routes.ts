import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import { statementLineParamSchema } from '../bank-reconciliation/bank-reconciliation.schemas.js'
import { createTreasuryAdjustmentFromStatementLineSchema } from './treasury-adjustment.schemas.js'
import * as controller from './treasury-adjustment.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/bank-statements/:statementId/lines/:lineId/treasury-adjustment',
  validateParams(statementLineParamSchema),
  requirePermission('finance.treasury.adjustment.create'),
  validateBody(createTreasuryAdjustmentFromStatementLineSchema),
  controller.createTreasuryAdjustmentFromStatementLineHandler,
)

export default router
