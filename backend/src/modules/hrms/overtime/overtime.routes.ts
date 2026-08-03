import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './overtime.controller.js'
import {
  approveOtSchema,
  bulkOtActionSchema,
  cancelOtSchema,
  createManualOtSchema,
  createOtPolicySchema,
  listOtPoliciesQuerySchema,
  listOtQuerySchema,
  monthlySummaryQuerySchema,
  otIdParamSchema,
  otPolicyIdParamSchema,
  regenerateOtSchema,
  rejectOtSchema,
  updateOtPolicySchema,
} from './overtime.schemas.js'

const router = Router({ mergeParams: true })

// Policies (setup)
router.get(
  '/policies',
  requirePermission('hrms.overtime.manage'),
  validateQuery(listOtPoliciesQuerySchema),
  controller.listPolicies,
)
router.post(
  '/policies',
  requirePermission('hrms.overtime.manage'),
  validateBody(createOtPolicySchema),
  controller.createPolicy,
)
router.patch(
  '/policies/:policyId',
  validateParams(otPolicyIdParamSchema),
  requirePermission('hrms.overtime.manage'),
  validateBody(updateOtPolicySchema),
  controller.updatePolicy,
)

// Records
router.get('/summary/monthly', requirePermission('hrms.overtime.view'), validateQuery(monthlySummaryQuerySchema), controller.monthlySummary)

router.post(
  '/regenerate',
  requirePermission('hrms.overtime.manage'),
  validateBody(regenerateOtSchema),
  controller.regenerate,
)

router.get('/', requirePermission('hrms.overtime.view'), validateQuery(listOtQuerySchema), controller.listOt)

router.post(
  '/',
  requirePermission('hrms.overtime.create'),
  validateBody(createManualOtSchema),
  controller.createManualOt,
)

router.post(
  '/bulk-approve',
  requirePermission('hrms.overtime.approve'),
  validateBody(bulkOtActionSchema),
  controller.bulkApprove,
)
router.post(
  '/bulk-reject',
  requirePermission('hrms.overtime.approve'),
  validateBody(bulkOtActionSchema),
  controller.bulkReject,
)

router.get('/:otId', validateParams(otIdParamSchema), requirePermission('hrms.overtime.view'), controller.getOt)

router.post(
  '/:otId/approve',
  validateParams(otIdParamSchema),
  requirePermission('hrms.overtime.approve'),
  validateBody(approveOtSchema),
  controller.approveOt,
)
router.post(
  '/:otId/reject',
  validateParams(otIdParamSchema),
  requirePermission('hrms.overtime.approve'),
  validateBody(rejectOtSchema),
  controller.rejectOt,
)
router.post(
  '/:otId/cancel',
  validateParams(otIdParamSchema),
  requirePermission('hrms.overtime.create'),
  validateBody(cancelOtSchema),
  controller.cancelOt,
)

export default router
