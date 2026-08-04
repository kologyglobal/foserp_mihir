import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-return.controller.js'
import {
  createPurchaseReturnSchema,
  linkReplacementGrnSchema,
  listPurchaseReturnsQuerySchema,
  purchaseReturnRemarksSchema,
  updatePurchaseReturnSchema,
} from './purchase-return.validation.js'

const router = Router({ mergeParams: true })
router.get('/', requirePermission('purchase.return.view'), validateQuery(listPurchaseReturnsQuerySchema), controller.listPurchaseReturns)
router.get('/wizard-prefill', requirePermission('purchase.return.create'), controller.getReturnWizardPrefill)
router.get('/trace', requirePermission('purchase.return.view'), controller.getTrace)
router.post('/', requirePermission('purchase.return.create'), validateBody(createPurchaseReturnSchema), controller.createPurchaseReturn)
router.get('/:id', requirePermission('purchase.return.view'), validateParams(uuidParamSchema), controller.getPurchaseReturn)
router.patch('/:id', requirePermission('purchase.return.edit'), validateParams(uuidParamSchema), validateBody(updatePurchaseReturnSchema), controller.updatePurchaseReturn)
router.post('/:id/submit', requirePermission('purchase.return.submit'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.submitPurchaseReturn)
router.post('/:id/approve', requirePermission('purchase.return.complete'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.approvePurchaseReturn)
router.post('/:id/ship', requirePermission('purchase.return.complete'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.shipPurchaseReturn)
router.post('/:id/complete', requirePermission('purchase.return.complete'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.completePurchaseReturn)
router.post('/:id/cancel', requirePermission('purchase.return.cancel'), validateParams(uuidParamSchema), validateBody(purchaseReturnRemarksSchema), controller.cancelPurchaseReturn)
router.get('/:id/ap-adjustment-preview', requirePermission('purchase.return.view'), validateParams(uuidParamSchema), controller.getPurchaseReturnApAdjustmentPreview)
router.post('/:id/ap-adjustment', requirePermission('purchase.return.complete'), validateParams(uuidParamSchema), controller.createPurchaseReturnApAdjustment)
router.post(
  '/:id/link-replacement-grn',
  requirePermission('purchase.return.edit'),
  validateParams(uuidParamSchema),
  validateBody(linkReplacementGrnSchema),
  controller.linkReplacementGrn,
)
export default router
