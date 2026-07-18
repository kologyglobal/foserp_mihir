import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import {
  ageingQuerySchema,
  customerIdParamSchema,
  customerSummaryQuerySchema,
  listOutstandingQuerySchema,
  overviewQuerySchema,
  reconciliationQuerySchema,
} from './receivable-reporting.schemas.js'
import * as controller from './receivable-reporting.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/overview', requirePermission('finance.ar.view'), validateQuery(overviewQuerySchema), controller.getOverview)
router.get('/outstanding', requirePermission('finance.ar.view'), validateQuery(listOutstandingQuerySchema), controller.listOutstanding)
router.get('/ageing', requirePermission('finance.ar.view'), validateQuery(ageingQuerySchema), controller.getAgeing)
router.get('/customers', requirePermission('finance.ar.view'), validateQuery(customerSummaryQuerySchema), controller.listCustomerSummaries)
router.get(
  '/customers/:customerId',
  requirePermission('finance.ar.view'),
  validateParams(customerIdParamSchema),
  validateQuery(overviewQuerySchema),
  controller.getCustomerSummary,
)
router.get(
  '/customers/:customerId/open-items',
  requirePermission('finance.ar.view'),
  validateParams(customerIdParamSchema),
  validateQuery(listOutstandingQuerySchema),
  controller.listCustomerOpenItems,
)
router.get(
  '/reconciliation',
  requirePermission('finance.ar.reconcile.view'),
  validateQuery(reconciliationQuerySchema),
  controller.getReconciliation,
)

export default router
