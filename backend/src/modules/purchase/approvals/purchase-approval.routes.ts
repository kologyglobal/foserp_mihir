import { Router } from 'express'
import { requireAnyPermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './purchase-approval.controller.js'
import {
  delegatePurchaseApprovalSchema,
  listPurchaseApprovalsQuerySchema,
} from './purchase-approval.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/',
  requireAnyPermission(
    'purchase.pr.approve',
    'purchase.po.approve',
    'purchase.pr.view',
    'purchase.po.view',
  ),
  validateQuery(listPurchaseApprovalsQuerySchema),
  controller.listPurchaseApprovals,
)

router.get(
  '/:id',
  requireAnyPermission(
    'purchase.pr.approve',
    'purchase.po.approve',
    'purchase.pr.view',
    'purchase.po.view',
  ),
  validateParams(uuidParamSchema),
  controller.getPurchaseApproval,
)

router.post(
  '/:id/delegate',
  requireAnyPermission('purchase.pr.approve', 'purchase.po.approve'),
  validateParams(uuidParamSchema),
  validateBody(delegatePurchaseApprovalSchema),
  controller.delegatePurchaseApproval,
)

export default router
