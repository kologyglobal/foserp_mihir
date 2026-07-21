import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import * as controller from './payable-close-gate.controller.js'
import {
  closeGateRunIdParamSchema,
  createCloseGateRunBodySchema,
  latestCloseGateQuerySchema,
  listCloseGateRunsQuerySchema,
} from './payable-reconciliation.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/runs',
  requirePermission('finance.ap.close_gate.run'),
  validateBody(createCloseGateRunBodySchema),
  controller.createCloseGateRunHandler,
)

router.get(
  '/runs',
  requirePermission('finance.ap.close_gate.view'),
  validateQuery(listCloseGateRunsQuerySchema),
  controller.listCloseGateRunsHandler,
)

router.get(
  '/latest',
  requirePermission('finance.ap.close_gate.view'),
  validateQuery(latestCloseGateQuerySchema),
  controller.getLatestCloseGateRunHandler,
)

router.get(
  '/runs/:id',
  requirePermission('finance.ap.close_gate.view'),
  validateParams(closeGateRunIdParamSchema),
  controller.getCloseGateRunHandler,
)

router.get(
  '/runs/:id/export',
  requirePermission('finance.ap.close_gate.export'),
  validateParams(closeGateRunIdParamSchema),
  controller.exportCloseGateRunHandler,
)

export default router
