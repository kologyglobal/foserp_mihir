import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  createApprovalRuleSchema,
  listApprovalRulesQuerySchema,
  updateApprovalRuleSchema,
} from './finance-approval-rule.validation.js'
import * as controller from './finance-approval-rule.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.approval_rule.view'), validateQuery(listApprovalRulesQuerySchema), controller.listApprovalRules)
router.post('/', requirePermission('finance.approval_rule.manage'), validateBody(createApprovalRuleSchema), controller.createApprovalRule)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.approval_rule.view'), controller.getApprovalRule)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.approval_rule.manage'),
  validateBody(updateApprovalRuleSchema),
  controller.updateApprovalRule,
)
router.delete('/:id', validateParams(uuidParamSchema), requirePermission('finance.approval_rule.manage'), controller.deleteApprovalRule)

export default router
