import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './sales-order.controller.js'
import {
  createSalesOrderSchema,
  listSalesOrdersQuerySchema,
  updateSalesOrderSchema,
} from './sales-order.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.sales_order.view'), validateQuery(listSalesOrdersQuerySchema), controller.listSalesOrders)
router.post('/', requirePermission('crm.sales_order.create'), validateBody(createSalesOrderSchema), controller.createSalesOrder)
router.get('/:id', requirePermission('crm.sales_order.view'), validateParams(uuidParamSchema), controller.getSalesOrder)
router.patch('/:id', requirePermission('crm.sales_order.update'), validateParams(uuidParamSchema), validateBody(updateSalesOrderSchema), controller.updateSalesOrder)
router.delete('/:id', requirePermission('crm.sales_order.delete'), validateParams(uuidParamSchema), controller.deleteSalesOrder)
router.post('/:id/confirm', requirePermission('crm.sales_order.confirm'), validateParams(uuidParamSchema), controller.confirmSalesOrder)
router.post('/:id/close', requirePermission('crm.sales_order.update'), validateParams(uuidParamSchema), controller.closeSalesOrder)

export default router
