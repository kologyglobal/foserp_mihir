import { Router } from 'express'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './statutory.controller.js'
import {
  createRuleSchema,
  listRulesQuerySchema,
  putPtSlabsSchema,
  putWageBasisSchema,
  registerKindParamSchema,
  registerQuerySchema,
  resolveRuleQuerySchema,
  ruleIdParamSchema,
  statutoryEmployeeIdParamSchema,
  updateEmployeeStatutoryProfileSchema,
  updateRuleSchema,
} from './statutory.schemas.js'

const router = Router({ mergeParams: true })

// ─── Rules ───────────────────────────────────────────────────────────────────

router.get('/rules', requirePermission('hrms.statutory.view'), validateQuery(listRulesQuerySchema), controller.listRules)
router.post('/rules', requirePermission('hrms.statutory.manage'), validateBody(createRuleSchema), controller.createRule)
router.get(
  '/rules/:ruleId',
  validateParams(ruleIdParamSchema),
  requirePermission('hrms.statutory.view'),
  controller.getRule,
)
router.patch(
  '/rules/:ruleId',
  validateParams(ruleIdParamSchema),
  requirePermission('hrms.statutory.manage'),
  validateBody(updateRuleSchema),
  controller.updateRule,
)
router.post(
  '/rules/:ruleId/activate',
  validateParams(ruleIdParamSchema),
  requirePermission('hrms.statutory.manage'),
  controller.activateRule,
)
router.put(
  '/rules/:ruleId/wage-basis',
  validateParams(ruleIdParamSchema),
  requirePermission('hrms.statutory.manage'),
  validateBody(putWageBasisSchema),
  controller.putWageBasis,
)
router.put(
  '/rules/:ruleId/pt-slabs',
  validateParams(ruleIdParamSchema),
  requirePermission('hrms.statutory.manage'),
  validateBody(putPtSlabsSchema),
  controller.putPtSlabs,
)

// ─── Employee profile ────────────────────────────────────────────────────────

router.get(
  '/employees/:employeeId/profile',
  validateParams(statutoryEmployeeIdParamSchema),
  requirePermission('hrms.statutory.view'),
  controller.getEmployeeProfile,
)
router.patch(
  '/employees/:employeeId/profile',
  validateParams(statutoryEmployeeIdParamSchema),
  requireAnyPermission('hrms.statutory.manage', 'hrms.statutory.override'),
  validateBody(updateEmployeeStatutoryProfileSchema),
  controller.updateEmployeeProfile,
)

// ─── Resolve helper ──────────────────────────────────────────────────────────

router.get(
  '/resolve',
  requirePermission('hrms.statutory.view'),
  validateQuery(resolveRuleQuerySchema),
  controller.resolveRule,
)

// ─── Registers ───────────────────────────────────────────────────────────────

router.get(
  '/registers/:kind',
  validateParams(registerKindParamSchema),
  requirePermission('hrms.statutory.reports'),
  validateQuery(registerQuerySchema),
  controller.getRegister,
)
router.get(
  '/registers/:kind/export.csv',
  validateParams(registerKindParamSchema),
  requirePermission('hrms.statutory.reports'),
  validateQuery(registerQuerySchema),
  controller.exportRegisterCsv,
)

export default router
