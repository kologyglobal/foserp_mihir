import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './leave.controller.js'
import {
  adjustBalanceSchema,
  approvedLeaveQuerySchema,
  cancelLeaveSchema,
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  createPolicySchema,
  leaveRequestIdParamSchema,
  leaveTypeIdParamSchema,
  listBalancesQuerySchema,
  listLeaveTypesQuerySchema,
  listPoliciesQuerySchema,
  listRequestsQuerySchema,
  policyIdParamSchema,
  postAccrualSchema,
  previewLeaveSchema,
  rejectLeaveSchema,
  updateLeaveRequestSchema,
  updateLeaveTypeSchema,
  updatePolicySchema,
  upsertBalanceSchema,
} from './leave.schemas.js'

const router = Router({ mergeParams: true })

// Types
router.get(
  '/types',
  requirePermission('hrms.leave.view'),
  validateQuery(listLeaveTypesQuerySchema),
  controller.listTypes,
)
router.post(
  '/types',
  requirePermission('hrms.leave.type.manage'),
  validateBody(createLeaveTypeSchema),
  controller.createType,
)
router.patch(
  '/types/:leaveTypeId',
  validateParams(leaveTypeIdParamSchema),
  requirePermission('hrms.leave.type.manage'),
  validateBody(updateLeaveTypeSchema),
  controller.updateType,
)

// Policies
router.get(
  '/policies',
  requirePermission('hrms.leave.manage'),
  validateQuery(listPoliciesQuerySchema),
  controller.listPolicies,
)
router.post(
  '/policies',
  requirePermission('hrms.leave.manage'),
  validateBody(createPolicySchema),
  controller.createPolicy,
)
router.patch(
  '/policies/:policyId',
  validateParams(policyIdParamSchema),
  requirePermission('hrms.leave.manage'),
  validateBody(updatePolicySchema),
  controller.updatePolicy,
)

// Balances
router.get(
  '/balances',
  requirePermission('hrms.leave.balance.view'),
  validateQuery(listBalancesQuerySchema),
  controller.listBalances,
)
router.post(
  '/balances',
  requirePermission('hrms.leave.balance.manage'),
  validateBody(upsertBalanceSchema),
  controller.upsertBalance,
)
router.post(
  '/balances/adjust',
  requirePermission('hrms.leave.balance.manage'),
  validateBody(adjustBalanceSchema),
  controller.adjustBalance,
)
router.post(
  '/balances/accrue',
  requirePermission('hrms.leave.balance.manage'),
  validateBody(postAccrualSchema),
  controller.postAccrual,
)

// Requests
router.post(
  '/preview',
  requirePermission('hrms.leave.apply'),
  validateBody(previewLeaveSchema),
  controller.preview,
)
router.get(
  '/requests',
  requirePermission('hrms.leave.view'),
  validateQuery(listRequestsQuerySchema),
  controller.listRequests,
)
router.post(
  '/requests',
  requirePermission('hrms.leave.apply'),
  validateBody(createLeaveRequestSchema),
  controller.createRequest,
)
router.get(
  '/requests/:requestId',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.view'),
  controller.getRequest,
)
router.patch(
  '/requests/:requestId',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.apply'),
  validateBody(updateLeaveRequestSchema),
  controller.updateRequest,
)
router.post(
  '/requests/:requestId/submit',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.apply'),
  controller.submitRequest,
)
router.post(
  '/requests/:requestId/approve',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.approve'),
  controller.approveRequest,
)
router.post(
  '/requests/:requestId/reject',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.approve'),
  validateBody(rejectLeaveSchema),
  controller.rejectRequest,
)
router.post(
  '/requests/:requestId/cancel',
  validateParams(leaveRequestIdParamSchema),
  requirePermission('hrms.leave.apply'),
  validateBody(cancelLeaveSchema),
  controller.cancelRequest,
)

// Attendance hook source
router.get(
  '/approved-days',
  requirePermission('hrms.leave.view'),
  validateQuery(approvedLeaveQuerySchema),
  controller.approvedSource,
)

export default router
