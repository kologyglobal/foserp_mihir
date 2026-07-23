import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission, requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './manufacturing-accounting.controller.js'
import {
  featureControlParamsSchema,
  listAccountingEventsQuerySchema,
  listFeatureControlsQuerySchema,
  putFeatureControlSchema,
  readinessQuerySchema,
  inventorySignOffBodySchema,
  financePilotSignOffBodySchema,
  enableBodySchema,
  disableBodySchema,
} from './manufacturing-accounting.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/gate',
  // Finance admins must resolve gate while flag is OFF (enablement UX).
  requireAnyPermission(
    'manufacturing.cost.view',
    'manufacturing.accounting.view',
    'manufacturing.accounting.readiness',
    'finance.settings.manage',
  ),
  controller.getGateStatus,
)

router.get(
  '/readiness',
  requireAnyPermission(
    'manufacturing.accounting.readiness',
    'manufacturing.accounting.view',
    'finance.settings.manage',
  ),
  validateQuery(readinessQuerySchema),
  controller.getAccountingReadiness,
)

router.post(
  '/sign-offs/inventory-reconciliation',
  requireAnyPermission(
    'manufacturing.accounting.reconcile_signoff',
    'manufacturing.accounting.reconcile',
    'finance.settings.manage',
  ),
  validateBody(inventorySignOffBodySchema),
  controller.postInventoryReconciliationSignOff,
)

router.post(
  '/sign-offs/finance-pilot',
  requireAnyPermission('manufacturing.accounting.finance_signoff', 'finance.settings.manage'),
  validateBody(financePilotSignOffBodySchema),
  controller.postFinancePilotSignOff,
)

router.post(
  '/enable',
  requireAnyPermission('manufacturing.accounting.enable', 'finance.settings.manage'),
  validateBody(enableBodySchema),
  controller.postEnableManufacturingAccounting,
)

router.post(
  '/disable',
  requireAnyPermission('manufacturing.accounting.disable', 'finance.settings.manage'),
  validateBody(disableBodySchema),
  controller.postDisableManufacturingAccounting,
)

// Wave 3 — MANUFACTURING_ACCOUNTING feature-control admin (enable requires readiness gate).
router.get(
  '/feature-controls',
  requireAnyPermission('manufacturing.accounting.view', 'finance.settings.manage'),
  validateQuery(listFeatureControlsQuerySchema),
  controller.listFeatureControls,
)

router.get(
  '/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING',
  validateParams(featureControlParamsSchema),
  requireAnyPermission('manufacturing.accounting.view', 'finance.settings.manage'),
  controller.getManufacturingAccountingFeatureControl,
)

router.put(
  '/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING',
  validateParams(featureControlParamsSchema),
  requirePermission('finance.settings.manage'),
  validateBody(putFeatureControlSchema),
  controller.putManufacturingAccountingFeatureControl,
)

router.get(
  '/events',
  requirePermission('manufacturing.cost.view'),
  validateQuery(listAccountingEventsQuerySchema),
  controller.listEvents,
)

router.get(
  '/events/:id',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.cost.view'),
  controller.getEvent,
)

export default router
