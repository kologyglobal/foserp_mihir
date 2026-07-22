import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import { z } from 'zod'
import * as controller from './demand.controller.js'
import { cancelDemandSchema, convertSalesOrderLineSchema, createManualDemandSchema, listDemandsQuerySchema } from './demand.schemas.js'

const router = Router({ mergeParams: true })

const salesOrderIdParamSchema = z.object({ salesOrderId: z.string().uuid() })
const salesOrderLineParamSchema = z.object({ salesOrderId: z.string().uuid(), lineRef: z.string().min(1) })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('manufacturing.demand.view'), validateQuery(listDemandsQuerySchema), controller.listDemands)
router.post(
  '/',
  requirePermission('manufacturing.demand.create'),
  validateBody(createManualDemandSchema),
  controller.createManualDemand,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.demand.view'), controller.getDemand)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.demand.create'),
  validateBody(cancelDemandSchema),
  controller.cancelDemand,
)

export default router

export const soConversionRouter = Router({ mergeParams: true })
soConversionRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

soConversionRouter.get('/sales-orders', requirePermission('manufacturing.demand.view'), controller.listEligibleSalesOrders)
soConversionRouter.get(
  '/sales-orders/:salesOrderId/lines',
  validateParams(salesOrderIdParamSchema),
  requirePermission('manufacturing.demand.view'),
  controller.getSalesOrderLineEligibility,
)
soConversionRouter.post(
  '/sales-orders/:salesOrderId/lines/:lineRef/convert',
  validateParams(salesOrderLineParamSchema),
  requirePermission('manufacturing.demand.convert'),
  validateBody(convertSalesOrderLineSchema),
  controller.convertSalesOrderLine,
)
