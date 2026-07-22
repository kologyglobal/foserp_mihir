import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import { gstExtractQuerySchema, gstSummaryQuerySchema } from './tax-compliance.schemas.js'
import * as controller from './tax-compliance.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/outward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listOutwardSupplies,
)

router.get(
  '/inward-supplies',
  requirePermission('finance.tax.view'),
  validateQuery(gstExtractQuerySchema),
  controller.listInwardSupplies,
)

router.get(
  '/summary',
  requirePermission('finance.tax.view'),
  validateQuery(gstSummaryQuerySchema),
  controller.getSummary,
)

export default router
