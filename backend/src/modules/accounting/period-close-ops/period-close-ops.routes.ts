import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  approveReopenRequestSchema,
  createCalendarEventSchema,
  createReopenRequestSchema,
  createTemplateSchema,
  listReopenRequestsQuerySchema,
  listTemplatesQuerySchema,
  rejectReopenRequestSchema,
  updateCalendarEventSchema,
  updateChecklistTaskSchema,
  updateTemplateSchema,
} from './period-close-ops.schemas.js'
import * as controller from './period-close-ops.controller.js'

const periodParamSchema = z.object({ periodId: z.string().uuid() })

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

// ── Checklist templates ───────────────────────────────────────────────────────
router.get(
  '/checklist-templates',
  requirePermission('finance.period.view'),
  validateQuery(listTemplatesQuerySchema),
  controller.listTemplates,
)
router.post(
  '/checklist-templates',
  requirePermission('finance.period.manage'),
  validateBody(createTemplateSchema),
  controller.createTemplate,
)
router.put(
  '/checklist-templates/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  validateBody(updateTemplateSchema),
  controller.updateTemplate,
)
router.post(
  '/checklist-templates/:id/archive',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  controller.archiveTemplate,
)

// ── Period checklist tasks ────────────────────────────────────────────────────
router.get(
  '/periods/:periodId/checklist-tasks',
  validateParams(periodParamSchema),
  requirePermission('finance.period.view'),
  controller.listChecklistTasks,
)
router.post(
  '/periods/:periodId/checklist/instantiate',
  validateParams(periodParamSchema),
  requirePermission('finance.period.manage'),
  controller.instantiateChecklist,
)
router.patch(
  '/checklist-tasks/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  validateBody(updateChecklistTaskSchema),
  controller.updateChecklistTask,
)

// ── Calendar ──────────────────────────────────────────────────────────────────
router.get(
  '/periods/:periodId/calendar-events',
  validateParams(periodParamSchema),
  requirePermission('finance.period.view'),
  controller.listCalendarEvents,
)
router.post(
  '/periods/:periodId/calendar-events',
  validateParams(periodParamSchema),
  requirePermission('finance.period.manage'),
  validateBody(createCalendarEventSchema),
  controller.createCalendarEvent,
)
router.post(
  '/periods/:periodId/calendar/generate',
  validateParams(periodParamSchema),
  requirePermission('finance.period.manage'),
  controller.generateCalendar,
)
router.put(
  '/calendar-events/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  validateBody(updateCalendarEventSchema),
  controller.updateCalendarEvent,
)
router.delete(
  '/calendar-events/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.manage'),
  controller.deleteCalendarEvent,
)

// ── Reopen requests ───────────────────────────────────────────────────────────
router.get(
  '/reopen-requests',
  requirePermission('finance.period.view'),
  validateQuery(listReopenRequestsQuerySchema),
  controller.listReopenRequests,
)
router.post(
  '/reopen-requests',
  requirePermission('finance.period.reopen_request'),
  validateBody(createReopenRequestSchema),
  controller.createReopenRequest,
)
router.get(
  '/reopen-requests/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.view'),
  controller.getReopenRequest,
)
router.post(
  '/reopen-requests/:id/submit',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen_request'),
  controller.submitReopenRequest,
)
router.post(
  '/reopen-requests/:id/approve',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen_approve'),
  validateBody(approveReopenRequestSchema),
  controller.approveReopenRequest,
)
router.post(
  '/reopen-requests/:id/reject',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen_approve'),
  validateBody(rejectReopenRequestSchema),
  controller.rejectReopenRequest,
)
router.post(
  '/reopen-requests/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen_request'),
  controller.cancelReopenRequest,
)
router.post(
  '/reopen-requests/:id/close',
  validateParams(uuidParamSchema),
  requirePermission('finance.period.reopen_approve'),
  controller.closeReopenRequest,
)

export default router
