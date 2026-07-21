import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveTreasuryTransferSchema,
  cancelTreasuryTransferSchema,
  createTreasuryTransferSchema,
  listTreasuryTransfersQuerySchema,
  markReadyTreasuryTransferSchema,
  rejectTreasuryTransferSchema,
  reviseTreasuryTransferSchema,
  submitTreasuryTransferSchema,
  updateTreasuryTransferSchema,
} from './treasury-transfer.schemas.js'
import {
  dispatchTreasuryTransferSchema,
  postTreasuryTransferSchema,
  receiveTreasuryTransferSchema,
  reverseTreasuryTransferSchema,
} from './treasury-transfer.schemas.js'
import * as controller from './treasury-transfer.controller.js'
import * as postingController from './posting/treasury-transfer-posting.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/in-transit',
  requirePermission('finance.treasury.transfer.in_transit.view'),
  validateQuery(listTreasuryTransfersQuerySchema),
  controller.listInTransitTreasuryTransfers,
)

router.get('/', requirePermission('finance.treasury.transfer.view'), validateQuery(listTreasuryTransfersQuerySchema), controller.listTreasuryTransfers)
router.post('/', requirePermission('finance.treasury.transfer.create'), validateBody(createTreasuryTransferSchema), controller.createTreasuryTransfer)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.transfer.view'), controller.getTreasuryTransfer)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.edit'),
  validateBody(updateTreasuryTransferSchema),
  controller.updateTreasuryTransfer,
)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.treasury.transfer.view'), controller.validateTreasuryTransfer)
router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.submit'),
  validateBody(submitTreasuryTransferSchema),
  controller.submitTreasuryTransfer,
)
router.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.approve'),
  validateBody(approveTreasuryTransferSchema),
  controller.approveTreasuryTransfer,
)
router.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.approve'),
  validateBody(rejectTreasuryTransferSchema),
  controller.rejectTreasuryTransfer,
)
router.post(
  '/:id/revise',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.edit'),
  validateBody(reviseTreasuryTransferSchema),
  controller.reviseTreasuryTransfer,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.edit'),
  validateBody(markReadyTreasuryTransferSchema),
  controller.markTreasuryTransferReady,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.cancel'),
  validateBody(cancelTreasuryTransferSchema),
  controller.cancelTreasuryTransfer,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.treasury.transfer.view'), controller.getTreasuryTransferApproval)

router.post(
  '/:id/post',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.post'),
  validateBody(postTreasuryTransferSchema),
  postingController.postTreasuryTransfer,
)
router.post(
  '/:id/dispatch',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.dispatch'),
  validateBody(dispatchTreasuryTransferSchema),
  postingController.dispatchTreasuryTransferHandler,
)
router.post(
  '/:id/receive',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.receive'),
  validateBody(receiveTreasuryTransferSchema),
  postingController.receiveTreasuryTransferHandler,
)
router.get(
  '/:id/reversal-preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.view'),
  postingController.getTreasuryTransferReversalPreviewHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.transfer.reverse'),
  validateBody(reverseTreasuryTransferSchema),
  postingController.reverseTreasuryTransfer,
)

export default router
