import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../../utils/pagination.js'
import * as controller from './exception.controller.js'
import {
  assignExceptionSchema,
  exceptionKeyParamSchema,
  listExceptionsQuerySchema,
  resolveExceptionSchema,
} from './exception.schemas.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('operations.exceptions.view'), validateQuery(listExceptionsQuerySchema), controller.listExceptions)
router.get('/summary', requirePermission('operations.exceptions.view'), controller.getSummary)
router.post(
  '/:exceptionKey/acknowledge',
  requirePermission('operations.exceptions.manage'),
  validateParams(exceptionKeyParamSchema),
  controller.acknowledgeException,
)
router.post(
  '/:exceptionKey/assign',
  requirePermission('operations.exceptions.manage'),
  validateParams(exceptionKeyParamSchema),
  validateBody(assignExceptionSchema),
  controller.assignException,
)
router.post(
  '/:exceptionKey/resolve',
  requirePermission('operations.exceptions.manage'),
  validateParams(exceptionKeyParamSchema),
  validateBody(resolveExceptionSchema),
  controller.resolveException,
)

export default router
