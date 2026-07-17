import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  generatePeriodsSchema,
  listPeriodsQuerySchema,
  reopenPeriodSchema,
  updatePeriodSchema,
} from './accounting-period.validation.js'
import * as controller from './accounting-period.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get('/', requirePermission('finance.period.view'), validateQuery(listPeriodsQuerySchema), controller.listPeriods)
router.post('/generate', requirePermission('finance.period.manage'), validateBody(generatePeriodsSchema), controller.generatePeriods)
router.get('/:id', validateParams(uuidParamSchema), requirePermission('finance.period.view'), controller.getPeriod)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  validateBody(updatePeriodSchema),
  controller.updatePeriod,
)
router.post(
  '/:id/mark-under-review',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  controller.markUnderReview,
)
router.post(
  '/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.close'),
  controller.closePeriod,
)
router.post(
  '/:id/reopen',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen'),
  validateBody(reopenPeriodSchema),
  controller.reopenPeriod,
)

export default router
