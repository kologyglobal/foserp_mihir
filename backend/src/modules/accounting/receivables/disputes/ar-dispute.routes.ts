import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  createArDisputeSchema,
  listArDisputesQuerySchema,
  transitionArDisputeSchema,
  updateArDisputeSchema,
} from './ar-dispute.schemas.js'
import * as controller from './ar-dispute.controller.js'

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
  requirePermission('finance.ar.dispute.view'),
  validateQuery(listArDisputesQuerySchema),
  controller.listArDisputes,
)
router.post(
  '/',
  requirePermission('finance.ar.dispute.create'),
  validateBody(createArDisputeSchema),
  controller.createArDispute,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.dispute.view'),
  controller.getArDispute,
)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.dispute.edit'),
  validateBody(updateArDisputeSchema),
  controller.updateArDispute,
)
router.post(
  '/:id/transition',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.dispute.edit'),
  validateBody(transitionArDisputeSchema),
  controller.transitionArDispute,
)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.dispute.edit'),
  controller.softDeleteArDispute,
)

export default router
