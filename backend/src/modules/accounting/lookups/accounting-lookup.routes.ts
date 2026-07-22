import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  customerLookupQuerySchema,
  eligibilityQuerySchema,
  dispatchLookupQuerySchema,
  grnLookupQuerySchema,
  itemLookupQuerySchema,
  purchaseOrderLookupQuerySchema,
  salesOrderLookupQuerySchema,
  accountingLookupListQuerySchema,
} from './accounting-lookup.schemas.js'
import * as controller from './accounting-lookup.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

/** Finance users may browse masters for invoice pickers via accounting lookups. */
const viewAr = requirePermission('finance.ar.invoice.view')
const viewAp = requirePermission('finance.ap.vendor_invoice.view')
const viewEither = requireAnyPermission('finance.ar.invoice.view', 'finance.ap.vendor_invoice.view')

router.get('/customers', viewAr, validateQuery(customerLookupQuerySchema), controller.listCustomers)
router.get('/customers/:id', viewAr, validateParams(uuidParamSchema), controller.getCustomer)

router.get('/vendors', viewAp, validateQuery(accountingLookupListQuerySchema), controller.listVendors)
router.get('/vendors/:id', viewAp, validateParams(uuidParamSchema), controller.getVendor)

router.get('/items', viewEither, validateQuery(itemLookupQuerySchema), controller.listItems)
router.get('/items/:id', viewEither, validateParams(uuidParamSchema), controller.getItem)

router.get(
  '/sales-orders',
  viewAr,
  validateQuery(salesOrderLookupQuerySchema),
  controller.listSalesOrders,
)
router.get(
  '/sales-orders/:id/invoice-eligibility',
  viewAr,
  validateParams(uuidParamSchema),
  validateQuery(eligibilityQuerySchema),
  controller.getSalesOrderEligibility,
)

router.get(
  '/purchase-orders',
  viewAp,
  validateQuery(purchaseOrderLookupQuerySchema),
  controller.listPurchaseOrders,
)
router.get(
  '/purchase-orders/:id/invoice-eligibility',
  viewAp,
  validateParams(uuidParamSchema),
  validateQuery(eligibilityQuerySchema),
  controller.getPurchaseOrderEligibility,
)

router.get('/grns', viewAp, validateQuery(grnLookupQuerySchema), controller.listGrns)
router.get(
  '/grns/:id/invoice-eligibility',
  viewAp,
  validateParams(uuidParamSchema),
  validateQuery(eligibilityQuerySchema),
  controller.getGrnEligibility,
)

router.get('/dispatches', viewAr, validateQuery(dispatchLookupQuerySchema), controller.listDispatches)
router.get(
  '/dispatches/:id/invoice-eligibility',
  viewAr,
  validateParams(uuidParamSchema),
  validateQuery(eligibilityQuerySchema),
  controller.getDispatchEligibility,
)

export default router
