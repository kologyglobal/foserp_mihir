import { Router } from 'express'
import { authenticate } from '../../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../../utils/pagination.js'
import {
  cancelRecurringScheduleSchema,
  createRecurringScheduleSchema,
  listRecurringSchedulesQuerySchema,
  listUpcomingInvoicesQuerySchema,
  recurringExecutionIdParamSchema,
} from './recurring-invoice.schemas.js'
import * as controller from './recurring-invoice.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/upcoming',
  requirePermission('finance.ar.invoice.view'),
  validateQuery(listUpcomingInvoicesQuerySchema),
  controller.listUpcomingInvoices,
)
router.get(
  '/',
  requirePermission('finance.ar.invoice.view'),
  validateQuery(listRecurringSchedulesQuerySchema),
  controller.listRecurringSchedules,
)
router.post(
  '/',
  requirePermission('finance.ar.invoice.create'),
  validateBody(createRecurringScheduleSchema),
  controller.createRecurringSchedule,
)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.view'),
  controller.getRecurringSchedule,
)
router.post(
  '/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.ar.invoice.cancel'),
  validateBody(cancelRecurringScheduleSchema),
  controller.cancelRecurringSchedule,
)
router.post(
  '/:id/executions/:executionId/approve',
  validateParams(recurringExecutionIdParamSchema),
  requirePermission('finance.ar.invoice.create'),
  controller.approveUpcomingInvoice,
)

export default router
