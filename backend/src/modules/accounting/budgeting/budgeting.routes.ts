import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './budgeting.controller.js'
import {
  budgetLifecycleSchema,
  budgetVsActualQuerySchema,
  createBudgetLineSchema,
  createBudgetVersionSchema,
  listBudgetVersionsQuerySchema,
  overviewQuerySchema,
  updateBudgetLineSchema,
  updateBudgetVersionSchema,
} from './budgeting.schemas.js'
import { z } from 'zod'

const versionAndLineParams = z.object({
  tenantSlug: z.string().min(1),
  id: z.string().uuid(),
  lineId: z.string().uuid(),
})

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/overview', requirePermission('finance.budget.view'), validateQuery(overviewQuerySchema), controller.getOverview)

router.get(
  '/budget-vs-actual',
  requirePermission('finance.budget.view'),
  validateQuery(budgetVsActualQuerySchema),
  controller.getBudgetVsActual,
)

router.get(
  '/versions',
  requirePermission('finance.budget.view'),
  validateQuery(listBudgetVersionsQuerySchema),
  controller.listVersions,
)

router.post(
  '/versions',
  requirePermission('finance.budget.create'),
  validateBody(createBudgetVersionSchema),
  controller.createVersion,
)

router.get(
  '/versions/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.view'),
  controller.getVersion,
)

router.patch(
  '/versions/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.edit'),
  validateBody(updateBudgetVersionSchema),
  controller.updateVersion,
)

router.post(
  '/versions/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.edit'),
  validateBody(budgetLifecycleSchema),
  controller.submitVersion,
)

router.post(
  '/versions/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.approve'),
  validateBody(budgetLifecycleSchema),
  controller.approveVersion,
)

router.post(
  '/versions/:id/lock',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.approve'),
  validateBody(budgetLifecycleSchema),
  controller.lockVersion,
)

router.get(
  '/versions/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.view'),
  controller.listLines,
)

router.post(
  '/versions/:id/lines',
  validateParams(uuidParamSchema),
  requirePermission('finance.budget.edit'),
  validateBody(createBudgetLineSchema),
  controller.createLine,
)

router.patch(
  '/versions/:id/lines/:lineId',
  validateParams(versionAndLineParams),
  requirePermission('finance.budget.edit'),
  validateBody(updateBudgetLineSchema),
  controller.updateLine,
)

router.delete(
  '/versions/:id/lines/:lineId',
  validateParams(versionAndLineParams),
  requirePermission('finance.budget.edit'),
  controller.deleteLine,
)

export default router
