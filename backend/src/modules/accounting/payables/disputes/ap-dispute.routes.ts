import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import * as controller from './ap-dispute.controller.js'
import {
  createApDisputeSchema,
  listApDisputesQuerySchema,
  transitionApDisputeSchema,
  updateApDisputeSchema,
} from './ap-dispute.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/',
  requirePermission('finance.ap.dispute.view'),
  validateQuery(listApDisputesQuerySchema),
  controller.listApDisputes,
)
router.post(
  '/',
  requirePermission('finance.ap.dispute.create'),
  validateBody(createApDisputeSchema),
  controller.createApDispute,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.dispute.view'),
  controller.getApDispute,
)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.dispute.edit'),
  validateBody(updateApDisputeSchema),
  controller.updateApDispute,
)
router.post(
  '/:id/transition',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.dispute.edit'),
  validateBody(transitionApDisputeSchema),
  controller.transitionApDispute,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ap.dispute.edit'),
  controller.softDeleteApDispute,
)

export default router
