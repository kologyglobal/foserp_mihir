import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-return.controller.js'
import { createPurchaseReturnSchema, listPurchaseReturnsQuerySchema, purchaseReturnRemarksSchema, updatePurchaseReturnSchema } from './purchase-return.validation.js'
const router = Router({ mergeParams: true })
router.get('/', requirePermission('purchase.return.view'), validateQuery(listPurchaseReturnsQuerySchema), controller.listPurchaseReturns)
router.post('/', requirePermission('purchase.return.create'), validateBody(createPurchaseReturnSchema), controller.createPurchaseReturn)
router.get('/:id', requirePermission('purchase.return.view'), validateParams(uuidParamSchema), controller.getPurchaseReturn)
router.patch('/:id', requirePermission('purchase.return.edit'), validateParams(uuidParamSchema), validateBody(updatePurchaseReturnSchema), controller.updatePurchaseReturn)
router.post('/:id/submit', requirePermission('purchase.return.submit'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.submitPurchaseReturn)
router.post('/:id/complete', requirePermission('purchase.return.complete'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.completePurchaseReturn)
router.post('/:id/cancel', requirePermission('purchase.return.cancel'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.cancelPurchaseReturn)
export default router
