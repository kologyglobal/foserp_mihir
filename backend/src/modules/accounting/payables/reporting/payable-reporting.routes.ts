import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../../utils/pagination.js'
import {
  ageingQuerySchema,
  listOutstandingQuerySchema,
  overviewQuerySchema,
  paymentPlanningQuerySchema,
  vendorIdParamSchema,
  vendorSummaryQuerySchema,
} from './payable-reporting.schemas.js'
import * as controller from './payable-reporting.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/overview', requirePermission('finance.ap.view'), validateQuery(overviewQuerySchema), controller.getOverview)
router.get('/outstanding', requirePermission('finance.ap.view'), validateQuery(listOutstandingQuerySchema), controller.listOutstanding)
router.get('/ageing', requirePermission('finance.ap.view'), validateQuery(ageingQuerySchema), controller.getAgeing)
router.get('/vendors', requirePermission('finance.ap.view'), validateQuery(vendorSummaryQuerySchema), controller.listVendorSummaries)
router.get(
  '/vendors/:vendorId',
  requirePermission('finance.ap.view'),
  validateParams(vendorIdParamSchema),
  validateQuery(overviewQuerySchema),
  controller.getVendorSummary,
)
router.get(
  '/vendors/:vendorId/open-items',
  requirePermission('finance.ap.view'),
  validateParams(vendorIdParamSchema),
  validateQuery(listOutstandingQuerySchema),
  controller.listVendorOpenItems,
)
router.get(
  '/payment-planning',
  requirePermission('finance.ap.view'),
  validateQuery(paymentPlanningQuerySchema),
  controller.getPaymentPlanning,
)

export default router
