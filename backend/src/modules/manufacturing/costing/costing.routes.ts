import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './costing.controller.js'
import {
  calculateWorkOrderCostSchema,
  createCostingPolicySchema,
  listCostingPoliciesQuerySchema,
  updateCostingPolicySchema,
} from './costing.schemas.js'

const router = Router({ mergeParams: true })
router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/costing/policies', requirePermission('manufacturing.costing_policy.view'), validateQuery(listCostingPoliciesQuerySchema), controller.listPolicies)
router.post('/costing/policies', requirePermission('manufacturing.costing_policy.manage'), validateBody(createCostingPolicySchema), controller.createPolicy)
router.get('/costing/policies/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.view'), controller.getPolicy)
router.patch('/costing/policies/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), validateBody(updateCostingPolicySchema), controller.updatePolicy)
router.delete('/costing/policies/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), controller.deletePolicy)
router.post('/costing/policies/:id/activate', validateParams(uuidParamSchema), requirePermission('manufacturing.costing_policy.manage'), controller.activatePolicy)
router.get('/costing/readiness', requirePermission('manufacturing.accounting.view'), controller.getTenantReadiness)

router.get('/work-orders/:id/cost-summary', validateParams(uuidParamSchema), requirePermission('manufacturing.cost.view'), controller.getCostSummary)
router.get('/work-orders/:id/cost-details', validateParams(uuidParamSchema), requirePermission('manufacturing.cost.view'), controller.getCostDetails)
router.post('/work-orders/:id/cost/calculate', validateParams(uuidParamSchema), requirePermission('manufacturing.cost.calculate'), validateBody(calculateWorkOrderCostSchema), controller.calculateCost)
router.get('/work-orders/:id/cost-snapshots', validateParams(uuidParamSchema), requirePermission('manufacturing.cost.view'), controller.getCostSnapshots)
router.get('/work-orders/:id/accounting-readiness', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.view'), controller.getWorkOrderReadiness)
router.post('/work-orders/:id/cost/absorption', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.post'), controller.recordAbsorption)
router.post('/work-orders/:id/cost/absorption/post', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.post'), controller.recordAndPostAbsorption)
router.post('/work-orders/:id/financial-close/preview', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.financial_close'), controller.previewFinancialClose)
router.post('/work-orders/:id/financial-close', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.financial_close'), controller.financialClose)

router.post('/accounting/events/:id/validate', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.validate'), controller.validateEvent)
router.post('/accounting/events/:id/post', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.post'), controller.postEvent)
router.post('/accounting/events/:id/retry', validateParams(uuidParamSchema), requirePermission('manufacturing.accounting.retry'), controller.retryEvent)
router.get('/accounting/workspace/summary', requirePermission('manufacturing.accounting.view'), controller.getWorkspaceSummary)
router.get('/accounting/workspace/unposted', requirePermission('manufacturing.accounting.view'), controller.getUnposted)
router.get('/accounting/workspace/failed', requirePermission('manufacturing.accounting.view'), controller.getFailed)
router.get('/accounting/workspace/provisional', requirePermission('manufacturing.accounting.view'), controller.getProvisional)
router.get('/accounting/workspace/close-ready', requirePermission('manufacturing.accounting.view'), controller.getCloseReady)
router.get('/accounting/workspace/reconciliation', requirePermission('manufacturing.accounting.reconcile'), controller.getReconciliation)

export default router
