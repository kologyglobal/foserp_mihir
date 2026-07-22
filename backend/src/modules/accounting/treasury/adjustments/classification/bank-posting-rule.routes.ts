import { Router } from 'express'
import { authenticate } from '../../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../../middleware/permission.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../../utils/pagination.js'
import { statementLineParamSchema } from '../../bank-reconciliation/bank-reconciliation.schemas.js'
import { classifyStatementLineSchema, createBankPostingRuleSchema, listBankPostingRulesQuerySchema, updateBankPostingRuleSchema } from './bank-posting-rule.schemas.js'
import * as controller from './bank-posting-rule.controller.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/bank-posting-rules', requirePermission('finance.treasury.posting_rule.view'), validateQuery(listBankPostingRulesQuerySchema), controller.listBankPostingRules)
router.post('/bank-posting-rules', requirePermission('finance.treasury.posting_rule.manage'), validateBody(createBankPostingRuleSchema), controller.createBankPostingRule)
router.get('/bank-posting-rules/:id', validateParams(uuidParamSchema), requirePermission('finance.treasury.posting_rule.view'), controller.getBankPostingRule)
router.patch(
  '/bank-posting-rules/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.posting_rule.manage'),
  validateBody(updateBankPostingRuleSchema),
  controller.updateBankPostingRule,
)
router.post(
  '/bank-posting-rules/:id/deactivate',
  validateParams(uuidParamSchema),
  requirePermission('finance.treasury.posting_rule.manage'),
  controller.deactivateBankPostingRule,
)

router.post(
  '/bank-statements/:statementId/lines/:lineId/classify',
  validateParams(statementLineParamSchema),
  requirePermission('finance.treasury.adjustment.view'),
  validateBody(classifyStatementLineSchema),
  controller.classifyStatementLineHandler,
)

export default router
