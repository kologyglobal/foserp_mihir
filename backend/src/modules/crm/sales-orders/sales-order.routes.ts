import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as phase7c1Controller from '../../dispatch/phase7c1/phase7c1.controller.js'
import * as controller from './sales-order.controller.js'
import * as fulfilmentController from './fulfilment/sales-order-fulfilment.controller.js'
import * as commercialPositionController from './commercial-position/sales-order-commercial-position.controller.js'
import {
  salesOrderLineIdParamSchema,
  setCancelledQtySchema,
} from './fulfilment/sales-order-fulfilment.schemas.js'
import {
  createSalesOrderSchema,
  listSalesOrdersQuerySchema,
  updateSalesOrderSchema,
} from './sales-order.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.sales_order.view'), validateQuery(listSalesOrdersQuerySchema), controller.listSalesOrders)
router.post('/', requirePermission('crm.sales_order.create'), validateBody(createSalesOrderSchema), controller.createSalesOrder)
router.get(
  '/:id/commercial-position',
  requireAnyPermission('crm.sales_order.view', 'dispatch.fulfilment.view', 'dispatch.order.view'),
  validateParams(uuidParamSchema),
  commercialPositionController.getSalesOrderCommercialPosition,
)
router.get(
  '/:id/fulfilment',
  requirePermission('crm.sales_order.view'),
  validateParams(uuidParamSchema),
  fulfilmentController.getFulfilment,
)
router.get(
  '/:id/fulfilment-summary',
  requireAnyPermission('crm.sales_order.view', 'dispatch.fulfilment.view'),
  validateParams(uuidParamSchema),
  phase7c1Controller.salesOrderFulfilmentSummary,
)
router.get(
  '/:id/dispatch-requirements',
  requireAnyPermission('crm.sales_order.view', 'dispatch.requirement.view'),
  validateParams(uuidParamSchema),
  phase7c1Controller.salesOrderRequirements,
)
router.get(
  '/:id/dispatch-history',
  requireAnyPermission('crm.sales_order.view', 'dispatch.order.view', 'dispatch.view'),
  validateParams(uuidParamSchema),
  phase7c1Controller.salesOrderDispatchHistory,
)
router.post(
  '/:id/fulfilment/lines/:lineId/cancelled-qty',
  requirePermission('crm.sales_order.update'),
  validateParams(salesOrderLineIdParamSchema),
  validateBody(setCancelledQtySchema),
  fulfilmentController.setCancelledQty,
)
router.get('/:id', requirePermission('crm.sales_order.view'), validateParams(uuidParamSchema), controller.getSalesOrder)
router.patch('/:id', requirePermission('crm.sales_order.update'), validateParams(uuidParamSchema), validateBody(updateSalesOrderSchema), controller.updateSalesOrder)
router.delete('/:id', requirePermission('crm.sales_order.delete'), validateParams(uuidParamSchema), controller.deleteSalesOrder)
router.post('/:id/confirm', requirePermission('crm.sales_order.confirm'), validateParams(uuidParamSchema), controller.confirmSalesOrder)
router.post('/:id/close', requirePermission('crm.sales_order.update'), validateParams(uuidParamSchema), controller.closeSalesOrder)

export default router
