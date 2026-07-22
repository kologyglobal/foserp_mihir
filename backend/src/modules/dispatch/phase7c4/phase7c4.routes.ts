import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './phase7c4.controller.js'
import {
  createChallanSchema,
  dispatchOrderIdParamSchema,
  issueSchema,
  listChallansQuerySchema,
  reasonSchema,
  updateChallanSchema,
  uuidParamSchema,
} from './phase7c4.schemas.js'

const router = Router({ mergeParams: true })

router.post(
  '/orders/:id/delivery-challans',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.challan.create'),
  validateBody(createChallanSchema),
  controller.createChallan,
)

router.get(
  '/delivery-challans',
  requirePermission('dispatch.challan.view'),
  validateQuery(listChallansQuerySchema),
  controller.listChallans,
)

router.get(
  '/delivery-challans/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.view'),
  controller.getChallan,
)

router.patch(
  '/delivery-challans/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.edit'),
  validateBody(updateChallanSchema),
  controller.updateChallan,
)

router.post(
  '/delivery-challans/:id/refresh-from-packing',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.edit'),
  controller.refreshFromPacking,
)

router.post(
  '/delivery-challans/:id/ready-for-review',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.submit'),
  controller.readyForReview,
)

router.post(
  '/delivery-challans/:id/send-back',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.approve'),
  validateBody(reasonSchema),
  controller.sendBack,
)

router.post(
  '/delivery-challans/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.approve'),
  controller.approve,
)

router.post(
  '/delivery-challans/:id/issue',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.issue'),
  validateBody(issueSchema),
  controller.issue,
)

router.post(
  '/delivery-challans/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.cancel'),
  validateBody(reasonSchema),
  controller.cancel,
)

router.post(
  '/delivery-challans/:id/supersede',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.supersede'),
  validateBody(reasonSchema),
  controller.supersede,
)

router.get(
  '/delivery-challans/:id/reconciliation',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.reports'),
  controller.getReconciliation,
)

router.get(
  '/orders/:id/challan-position',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.challan.view'),
  controller.getChallanPosition,
)

router.get(
  '/delivery-challans/:id/preview',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.print'),
  controller.preview,
)

router.get(
  '/delivery-challans/:id/pdf',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.download'),
  controller.pdf,
)

router.post(
  '/delivery-challans/:id/generate-draft-preview',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.challan.print'),
  controller.generateDraftPreview,
)

router.get('/workbench/challan-drafts', requirePermission('dispatch.challan.view'), controller.workbenchChallanDrafts)
router.get('/workbench/challan-review', requirePermission('dispatch.challan.view'), controller.workbenchChallanReview)
router.get('/workbench/challans-issued', requirePermission('dispatch.challan.view'), controller.workbenchChallansIssued)
router.get(
  '/workbench/ready-for-dispatch',
  requirePermission('dispatch.challan.view'),
  controller.workbenchReadyForDispatch,
)
router.get(
  '/workbench/challan-exceptions',
  requirePermission('dispatch.challan.view'),
  controller.workbenchChallanExceptions,
)

export default router
