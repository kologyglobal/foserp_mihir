import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './manufacturing-accounting.controller.js'
import {
  featureControlParamsSchema,
  listAccountingEventsQuerySchema,
  listFeatureControlsQuerySchema,
  putFeatureControlSchema,
} from './manufacturing-accounting.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/gate',
  requirePermission('manufacturing.cost.view'),
  controller.getGateStatus,
)

// Wave 3 — MANUFACTURING_ACCOUNTING feature-control admin (enable requires readiness gate).
router.get(
  '/feature-controls',
  requirePermission('manufacturing.accounting.view'),
  validateQuery(listFeatureControlsQuerySchema),
  controller.listFeatureControls,
)

router.get(
  '/feature-controls/:legalEntityId/MANUFACTURING_ACCOUNTING',
  validateParams(featureControlParamsSchema),
  requirePermission('manufacturing.accounting.view'),
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
