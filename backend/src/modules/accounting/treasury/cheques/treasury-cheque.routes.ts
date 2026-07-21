import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  approveTreasuryChequeSchema,
  bounceTreasuryChequeSchema,
  cancelTreasuryChequeSchema,
  clearTreasuryChequeSchema,
  createTreasuryChequeSchema,
  depositTreasuryChequeSchema,
  issueTreasuryChequeSchema,
  listTreasuryChequesQuerySchema,
  markReadyTreasuryChequeSchema,
  rejectTreasuryChequeSchema,
  reverseTreasuryChequeSchema,
  reviseTreasuryChequeSchema,
  stopTreasuryChequeSchema,
  submitTreasuryChequeSchema,
  updateTreasuryChequeSchema,
} from './treasury-cheque.schemas.js'
import * as controller from './treasury-cheque.controller.js'
import * as postingController from './posting/treasury-cheque-posting.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/', requirePermission('finance.treasury.cheque.view'), validateQuery(listTreasuryChequesQuerySchema), controller.listTreasuryCheques)
router.post('/', requirePermission('finance.treasury.cheque.create'), validateBody(createTreasuryChequeSchema), controller.createTreasuryCheque)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.cheque.view'), controller.getTreasuryCheque)
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.edit'),
  validateBody(updateTreasuryChequeSchema),
  controller.updateTreasuryCheque,
)
router.post('/:id/validate', validateParams(uuidParamSchema), requirePermission('finance.treasury.cheque.view'), controller.validateTreasuryCheque)
router.post(
  '/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.submit'),
  validateBody(submitTreasuryChequeSchema),
  controller.submitTreasuryCheque,
)
router.post(
  '/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.approve'),
  validateBody(approveTreasuryChequeSchema),
  controller.approveTreasuryCheque,
)
router.post(
  '/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.approve'),
  validateBody(rejectTreasuryChequeSchema),
  controller.rejectTreasuryCheque,
)
router.post(
  '/:id/revise',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.edit'),
  validateBody(reviseTreasuryChequeSchema),
  controller.reviseTreasuryCheque,
)
router.post(
  '/:id/mark-ready',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.edit'),
  validateBody(markReadyTreasuryChequeSchema),
  controller.markTreasuryChequeReady,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.cancel'),
  validateBody(cancelTreasuryChequeSchema),
  controller.cancelTreasuryCheque,
)
router.get('/:id/approval', validateParams(uuidParamSchema), requirePermission('finance.treasury.cheque.view'), controller.getTreasuryChequeApproval)

router.post(
  '/:id/issue',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.issue'),
  validateBody(issueTreasuryChequeSchema),
  postingController.issueTreasuryChequeHandler,
)
router.post(
  '/:id/deposit',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.deposit'),
  validateBody(depositTreasuryChequeSchema),
  postingController.depositTreasuryChequeHandler,
)
router.post(
  '/:id/clear',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.clear'),
  validateBody(clearTreasuryChequeSchema),
  postingController.clearTreasuryChequeHandler,
)
router.post(
  '/:id/bounce',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.bounce'),
  validateBody(bounceTreasuryChequeSchema),
  postingController.bounceTreasuryChequeHandler,
)
router.post(
  '/:id/stop',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.stop'),
  validateBody(stopTreasuryChequeSchema),
  postingController.stopTreasuryChequeHandler,
)
router.post(
  '/:id/reverse',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.cheque.reverse'),
  validateBody(reverseTreasuryChequeSchema),
  postingController.reverseTreasuryChequeHandler,
)

export default router
