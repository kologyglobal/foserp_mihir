import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './issue.controller.js'
import {
  acknowledgeIssueSchema,
  cancelIssueSchema,
  listIssuesQuerySchema,
  reportIssueSchema,
  resolveIssueSchema,
} from './issue.schemas.js'

const router = Router({ mergeParams: true })

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.post('/', requirePermission('manufacturing.issue.report'), validateBody(reportIssueSchema), controller.reportIssue)
router.get('/', requirePermission('manufacturing.issue.view'), validateQuery(listIssuesQuerySchema), controller.listIssues)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('manufacturing.issue.view'), controller.getIssue)
router.post(
  '/:id/acknowledge',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.issue.acknowledge'),
  validateBody(acknowledgeIssueSchema),
  controller.acknowledgeIssue,
)
router.post(
  '/:id/in-progress',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.issue.acknowledge'),
  controller.markIssueInProgress,
)
router.post(
  '/:id/resolve',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.issue.resolve'),
  validateBody(resolveIssueSchema),
  controller.resolveIssue,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('manufacturing.issue.resolve'),
  validateBody(cancelIssueSchema),
  controller.cancelIssue,
)

export default router
