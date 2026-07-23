import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext, requirePermission } from '../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../middleware/tenant.middleware.js'
import { validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'
import * as securityController from './security.controller.js'
import {
  listAuditLogsQuerySchema,
  listLoginActivityQuerySchema,
  listSessionsQuerySchema,
  lockUserParamSchema,
  sessionIdParamSchema,
} from './security.validation.js'

const securityRouter = Router({ mergeParams: true })

securityRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

securityRouter.get(
  '/login-activity',
  requirePermission('security.view'),
  validateQuery(listLoginActivityQuerySchema),
  asyncHandler(securityController.listLoginActivity),
)

securityRouter.get(
  '/sessions',
  requirePermission('security.view'),
  validateQuery(listSessionsQuerySchema),
  asyncHandler(securityController.listSessions),
)

securityRouter.post(
  '/sessions/:sessionId/revoke',
  requirePermission('security.manage'),
  validateParams(sessionIdParamSchema),
  asyncHandler(securityController.revokeSession),
)

securityRouter.get(
  '/locked-accounts',
  requirePermission('security.view'),
  asyncHandler(securityController.listLockedAccounts),
)

securityRouter.get('/policy', requirePermission('security.view'), asyncHandler(securityController.getPolicy))

securityRouter.get(
  '/audit-logs',
  requirePermission('security.view'),
  validateQuery(listAuditLogsQuerySchema),
  asyncHandler(securityController.listAudit),
)

/** Mount under `/users` for lock/unlock lifecycle */
const userSecurityRouter = Router({ mergeParams: true })

userSecurityRouter.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

userSecurityRouter.post(
  '/:userId/lock',
  requirePermission('security.manage'),
  validateParams(lockUserParamSchema),
  asyncHandler(securityController.lockUser),
)

userSecurityRouter.post(
  '/:userId/unlock',
  requirePermission('security.manage'),
  validateParams(lockUserParamSchema),
  asyncHandler(securityController.unlockUser),
)

export { securityRouter, userSecurityRouter }
