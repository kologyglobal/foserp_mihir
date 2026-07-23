import { Router } from 'express'
import { z } from 'zod'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import {
  createDispatchReversalSchema,
  rejectDispatchReversalSchema,
} from './dispatch-reversal.schemas.js'
import {
  listDispatchDomainEventsQuerySchema,
} from './dispatch-domain-events.schemas.js'
import * as controller from './dispatch-posting.controller.js'

const router = Router({ mergeParams: true })

const outboundIdParamSchema = uuidParamSchema
const reversalIdParamSchema = z.object({
  reversalId: z.string().uuid(),
})
const eventIdParamSchema = z.object({
  eventId: z.string().uuid(),
})

router.get(
  '/outbound/:id/posting-readiness',
  validateParams(outboundIdParamSchema),
  requirePermission('dispatch.view'),
  controller.postingReadiness,
)

router.get(
  '/outbound/:id/reversal-dependencies',
  validateParams(outboundIdParamSchema),
  requirePermission('dispatch.view'),
  controller.reversalDependencies,
)

router.get(
  '/outbound/:id/reversals',
  validateParams(outboundIdParamSchema),
  requireAnyPermission('dispatch.view', 'dispatch.reverse.request'),
  controller.listOutboundReversals,
)

router.post(
  '/outbound/:id/reversals',
  validateParams(outboundIdParamSchema),
  requireAnyPermission('dispatch.reverse.request', 'dispatch.post', 'dispatch.override'),
  validateBody(createDispatchReversalSchema),
  controller.createOutboundReversal,
)

router.get(
  '/reversals/:reversalId',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.view', 'dispatch.reverse.request'),
  controller.getReversal,
)

router.post(
  '/reversals/:reversalId/submit',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.reverse.request', 'dispatch.post', 'dispatch.submit', 'dispatch.override'),
  controller.submitReversal,
)

router.post(
  '/reversals/:reversalId/approve',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.reverse.approve', 'dispatch.approve', 'dispatch.override'),
  controller.approveReversal,
)

router.post(
  '/reversals/:reversalId/reject',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.reverse.approve', 'dispatch.approve', 'dispatch.override'),
  validateBody(rejectDispatchReversalSchema),
  controller.rejectReversal,
)

router.post(
  '/reversals/:reversalId/cancel',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.reverse.request', 'dispatch.post', 'dispatch.cancel', 'dispatch.override'),
  controller.cancelReversal,
)

router.post(
  '/reversals/:reversalId/apply',
  validateParams(reversalIdParamSchema),
  requireAnyPermission('dispatch.reverse.apply', 'dispatch.post', 'dispatch.override'),
  controller.applyReversal,
)

router.get(
  '/domain-events',
  requirePermission('dispatch.view'),
  validateQuery(listDispatchDomainEventsQuerySchema),
  controller.listDomainEvents,
)

router.post(
  '/domain-events/process',
  requireAnyPermission('dispatch.post', 'dispatch.override'),
  controller.processDomainEvents,
)

router.get(
  '/domain-events/:eventId',
  validateParams(eventIdParamSchema),
  requirePermission('dispatch.view'),
  controller.getDomainEvent,
)

router.post(
  '/domain-events/:eventId/retry',
  validateParams(eventIdParamSchema),
  requireAnyPermission('dispatch.post', 'dispatch.override'),
  controller.retryDomainEvent,
)

router.get(
  '/reconciliation',
  requirePermission('dispatch.view'),
  controller.reconciliationReport,
)

router.get(
  '/reconciliation.csv',
  requirePermission('dispatch.export'),
  controller.reconciliationCsv,
)

export default router
