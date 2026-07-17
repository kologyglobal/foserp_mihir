import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  createBranchSchema,
  listBranchesQuerySchema,
  updateBranchSchema,
} from './branch.validation.js'
import * as nestedController from './branch.controller.js'

/** Nested under /legal-entities/:legalEntityId/branches */
export const nestedBranchRouter = Router({ mergeParams: true })

nestedBranchRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(z.object({ tenantId: z.string().uuid().optional(), tenantSlug: z.string().min(2).max(100).optional(), legalEntityId: z.string().uuid() }).refine((d) => Boolean(d.tenantId ?? d.tenantSlug), { message: 'tenantId or tenantSlug is required' })),
  resolveTenant,
  requireTenantAccess,
)

nestedBranchRouter.get('/', requirePermission('finance.branch.view'), validateQuery(listBranchesQuerySchema), nestedController.listBranches)
nestedBranchRouter.post('/', requirePermission('finance.branch.manage'), validateBody(createBranchSchema), nestedController.createBranch)

/** Direct branch routes under /branches/:id */
const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.branch.manage'),
  validateBody(updateBranchSchema),
  nestedController.updateBranch,
)
router.post(
  '/:id/set-default',
  validateParams(uuidParamSchema),
  requirePermission('finance.branch.manage'),
  nestedController.setDefaultBranch,
)
router.post(
  '/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.branch.manage'),
  nestedController.activateBranch,
)
router.post(
  '/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.branch.manage'),
  nestedController.deactivateBranch,
)

export default router
