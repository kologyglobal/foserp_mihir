import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './assignment.controller.js'
import {
  cancelAssignmentSchema,
  completeAssignmentSchema,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  pauseAssignmentSchema,
  reassignAssignmentSchema,
} from './assignment.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('manufacturing.assignment.view'),
  validateQuery(listAssignmentsQuerySchema),
  controller.listAssignments,
)
router.post(
  '/',
  requirePermission('manufacturing.assignment.manage'),
  validateBody(createAssignmentSchema),
  controller.createAssignment,
)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.assignment.view'), controller.getAssignment)
router.get(
  '/:id/history',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.assignment.view'),
  controller.listAssignmentHistory,
)
router.post(
  '/:id/reassign',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.assignment.reassign'),
  validateBody(reassignAssignmentSchema),
  controller.reassignAssignment,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.assignment.manage'),
  validateBody(cancelAssignmentSchema),
  controller.cancelAssignment,
)
router.post(
  '/:id/accept',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.operator.start', 'manufacturing.assignment.manage'),
  controller.acceptAssignment,
)
router.post(
  '/:id/start',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.operator.start', 'manufacturing.assignment.manage'),
  controller.startAssignment,
)
router.post(
  '/:id/pause',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.operator.pause', 'manufacturing.assignment.manage'),
  validateBody(pauseAssignmentSchema),
  controller.pauseAssignment,
)
router.post(
  '/:id/resume',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.operator.start', 'manufacturing.assignment.manage'),
  controller.resumeAssignment,
)
router.post(
  '/:id/complete',
  validateParams(uuidParamSchema),
  requireAnyPermission('manufacturing.operator.complete', 'manufacturing.assignment.manage'),
  validateBody(completeAssignmentSchema),
  controller.completeAssignment,
)

export default router
