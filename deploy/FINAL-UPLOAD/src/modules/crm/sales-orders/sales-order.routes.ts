import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './sales-order.controller.js'
import { listSalesOrdersQuerySchema } from './sales-order.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.sales_order.view'), validateQuery(listSalesOrdersQuerySchema), controller.listSalesOrders)
router.get('/:id', requirePermission('crm.sales_order.view'), validateParams(uuidParamSchema), controller.getSalesOrder)

export default router
