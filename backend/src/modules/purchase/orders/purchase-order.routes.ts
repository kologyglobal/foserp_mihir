import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-order.controller.js'
import { listPurchaseOrdersQuerySchema } from './purchase-order.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requirePermission('purchase.po.view'),
  validateQuery(listPurchaseOrdersQuerySchema),
  controller.listPurchaseOrders,
)

router.get(
  '/:id',
  requirePermission('purchase.po.view'),
  validateParams(uuidParamSchema),
  controller.getPurchaseOrder,
)

export default router
