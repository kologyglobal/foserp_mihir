import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  createPostingRuleSchema,
  listPostingRulesQuerySchema,
  updatePostingRuleSchema,
} from './ledger.schemas.js'
import * as controller from './ledger.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/schema-status', ...controller.getSchemaStatus)
router.get('/posting-engine-status', ...controller.getPostingEngineStatus)

router.get(
  '/posting-rules',
  requirePermission('finance.posting_rule.view'),
  validateQuery(listPostingRulesQuerySchema),
  controller.listPostingRules,
)
router.post(
  '/posting-rules',
  requirePermission('finance.posting_rule.manage'),
  validateBody(createPostingRuleSchema),
  controller.createPostingRule,
)
router.get(
  '/posting-rules/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.posting_rule.view'),
  controller.getPostingRule,
)
router.put(
  '/posting-rules/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.posting_rule.manage'),
  validateBody(updatePostingRuleSchema),
  controller.updatePostingRule,
)
router.post(
  '/posting-rules/:id/activate',
  validateParams(uuidParamSchema),
  requirePermission('finance.posting_rule.manage'),
  controller.activatePostingRule,
)
router.post(
  '/posting-rules/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.posting_rule.manage'),
  controller.deactivatePostingRule,
)

export default router
