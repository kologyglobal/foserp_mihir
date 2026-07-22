import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './movement.controller.js'
import {
  adjustmentMovementSchema,
  fgDispatchIssueSchema,
  fgReceiptSchema,
  issueToWorkOrderSchema,
  positiveQtyMovementSchema,
  returnFromWorkOrderSchema,
} from './movement.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post(
  '/opening',
  requireAnyPermission('inventory.receipts.post', 'inventory.post'),
  validateBody(positiveQtyMovementSchema),
  controller.postOpening,
)

router.post(
  '/inward',
  requireAnyPermission('inventory.receipts.post', 'inventory.post'),
  validateBody(positiveQtyMovementSchema),
  controller.postInward,
)

router.post('/issue', requirePermission('inventory.issues.post'), validateBody(positiveQtyMovementSchema), controller.postIssue)

router.post(
  '/adjustment',
  requirePermission('inventory.adjustments.post'),
  validateBody(adjustmentMovementSchema),
  controller.postAdjustment,
)

router.post(
  '/issue-to-work-order',
  requirePermission('inventory.issues.post'),
  validateBody(issueToWorkOrderSchema),
  controller.postIssueToWorkOrder,
)

router.post(
  '/return-from-work-order',
  requirePermission('inventory.returns.post'),
  validateBody(returnFromWorkOrderSchema),
  controller.postReturnFromWorkOrder,
)

router.post(
  '/fg-receipt',
  requireAnyPermission('inventory.receipts.post', 'inventory.post'),
  validateBody(fgReceiptSchema),
  controller.postFgReceipt,
)

router.post(
  '/fg-dispatch',
  requireAnyPermission('inventory.issues.post', 'dispatch.post'),
  validateBody(fgDispatchIssueSchema),
  controller.postFgDispatchIssue,
)

export default router
