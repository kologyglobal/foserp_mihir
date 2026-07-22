import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import * as controller from './payable-reconciliation.controller.js'
import {
  acknowledgeExceptionBodySchema,
  createReconciliationRunBodySchema,
  listReconciliationAccountsQuerySchema,
  listReconciliationExceptionsQuerySchema,
  listReconciliationRunsQuerySchema,
  reconciliationExceptionIdParamSchema,
  reconciliationRunIdParamSchema,
} from './payable-reconciliation.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/runs',
  requirePermission('finance.ap.reconciliation.run'),
  validateBody(createReconciliationRunBodySchema),
  controller.createReconciliationRunHandler,
)

router.get(
  '/runs',
  requirePermission('finance.ap.reconciliation.view'),
  validateQuery(listReconciliationRunsQuerySchema),
  controller.listReconciliationRunsHandler,
)

router.get(
  '/runs/:id',
  requirePermission('finance.ap.reconciliation.view'),
  validateParams(reconciliationRunIdParamSchema),
  controller.getReconciliationRunHandler,
)

router.get(
  '/runs/:id/accounts',
  requirePermission('finance.ap.reconciliation.view'),
  validateParams(reconciliationRunIdParamSchema),
  validateQuery(listReconciliationAccountsQuerySchema),
  controller.listReconciliationRunAccountsHandler,
)

router.get(
  '/runs/:id/vendors',
  requirePermission('finance.ap.reconciliation.view'),
  validateParams(reconciliationRunIdParamSchema),
  validateQuery(listReconciliationAccountsQuerySchema),
  controller.listReconciliationRunVendorsHandler,
)

router.get(
  '/runs/:id/exceptions',
  requirePermission('finance.ap.reconciliation.exception.view'),
  validateParams(reconciliationRunIdParamSchema),
  validateQuery(listReconciliationExceptionsQuerySchema),
  controller.listReconciliationRunExceptionsHandler,
)

router.get(
  '/runs/:id/export',
  requirePermission('finance.ap.reconciliation.export'),
  validateParams(reconciliationRunIdParamSchema),
  controller.exportReconciliationRunHandler,
)

router.get(
  '/exceptions/:id',
  requirePermission('finance.ap.reconciliation.exception.view'),
  validateParams(reconciliationExceptionIdParamSchema),
  controller.getReconciliationExceptionHandler,
)

router.post(
  '/exceptions/:id/acknowledge',
  requirePermission('finance.ap.reconciliation.exception.acknowledge'),
  validateParams(reconciliationExceptionIdParamSchema),
  validateBody(acknowledgeExceptionBodySchema),
  controller.acknowledgeReconciliationExceptionHandler,
)

export default router
