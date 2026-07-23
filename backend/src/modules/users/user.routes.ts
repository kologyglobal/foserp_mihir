import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as userController from './user.controller.js'
import {
  assignRoleSchema,
  createUserSchema,
  inviteUserSchema,
  listInvitationsQuerySchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
  userRoleParamSchema,
} from './user.validation.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get(
  '/',
  requirePermission('user.view'),
  validateQuery(listUsersQuerySchema),
  asyncHandler(userController.list),
)

router.get(
  '/invitations',
  requirePermission('user.view'),
  validateQuery(listInvitationsQuerySchema),
  asyncHandler(userController.listInvitations),
)

router.post(
  '/invite',
  requirePermission('user.create'),
  validateBody(inviteUserSchema),
  asyncHandler(userController.invite),
)

router.post(
  '/',
  requirePermission('user.create'),
  validateBody(createUserSchema),
  asyncHandler(userController.create),
)

router.get(
  '/:userId',
  requirePermission('user.view'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.getById),
)

router.patch(
  '/:userId',
  requirePermission('user.update'),
  validateParams(userIdParamSchema),
  validateBody(updateUserSchema),
  asyncHandler(userController.update),
)

router.delete(
  '/:userId',
  requirePermission('user.delete'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.remove),
)

router.post(
  '/:userId/resend-invitation',
  requirePermission('user.create'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.resendInvitation),
)

router.post(
  '/:userId/deactivate',
  requirePermission('user.update'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.deactivate),
)

router.post(
  '/:userId/activate',
  requirePermission('user.update'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.activate),
)

router.get(
  '/:userId/sessions',
  requirePermission('user.view'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.listSessions),
)

router.post(
  '/:userId/revoke-sessions',
  requirePermission('user.update'),
  validateParams(userIdParamSchema),
  asyncHandler(userController.revokeSessions),
)

router.post(
  '/:userId/roles',
  requirePermission('user.assign_role'),
  validateParams(userIdParamSchema),
  validateBody(assignRoleSchema),
  asyncHandler(userController.assignRole),
)

router.delete(
  '/:userId/roles/:roleId',
  requirePermission('user.assign_role'),
  validateParams(userRoleParamSchema),
  asyncHandler(userController.removeRole),
)

export default router
