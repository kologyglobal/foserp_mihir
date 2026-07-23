/**
 * Phase 7C5 posting / readiness / reconciliation / reversal HTTP handlers.
 */
import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { getOutboundPostingReadiness } from './dispatch-posting-readiness.service.js'
import {
  reconcileTenantDispatches,
  reconciliationToCsv,
} from './dispatch-reconciliation.service.js'
import { inspectReversalDependencies } from './dispatch-reversal.service.js'

export const postingReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const mode = req.query.mode === 'confirm' ? 'confirm' : 'post'
  const row = await getOutboundPostingReadiness(tenantId, id, mode)
  return sendSuccess(res, 'Dispatch posting readiness', row)
})

export const reconciliationReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId =
    typeof req.query.salesOrderId === 'string' ? req.query.salesOrderId : undefined
  const report = await reconcileTenantDispatches(tenantId, { salesOrderId })
  return sendSuccess(res, 'Dispatch reconciliation report', report)
})

export const reconciliationCsv = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const salesOrderId =
    typeof req.query.salesOrderId === 'string' ? req.query.salesOrderId : undefined
  const report = await reconcileTenantDispatches(tenantId, { salesOrderId })
  const csv = reconciliationToCsv(report.exceptions)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="dispatch-reconciliation.csv"')
  return res.status(200).send(csv)
})

export const reversalDependencies = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const deps = await inspectReversalDependencies(tenantId, id)
  return sendSuccess(res, 'Dispatch reversal dependencies', { dependencies: deps })
})

export const listOutboundReversals = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const { listReversalsForOutbound } = await import('./dispatch-reversal.service.js')
  const rows = await listReversalsForOutbound(tenantId, id)
  return sendSuccess(res, 'Dispatch reversals listed', rows)
})

export const createOutboundReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const { createReversalRequest } = await import('./dispatch-reversal.service.js')
  const row = await createReversalRequest(req, tenantId, id, req.body)
  return sendSuccess(res, 'Dispatch reversal request created', row, 201)
})

export const getReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { getReversal } = await import('./dispatch-reversal.service.js')
  const row = await getReversal(tenantId, reversalId)
  return sendSuccess(res, 'Dispatch reversal fetched', row)
})

export const submitReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { submitReversal } = await import('./dispatch-reversal.service.js')
  const row = await submitReversal(req, tenantId, reversalId)
  return sendSuccess(res, 'Dispatch reversal submitted', row)
})

export const approveReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { approveReversal } = await import('./dispatch-reversal.service.js')
  const row = await approveReversal(req, tenantId, reversalId)
  return sendSuccess(res, 'Dispatch reversal approved', row)
})

export const rejectReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { rejectReversal } = await import('./dispatch-reversal.service.js')
  const row = await rejectReversal(req, tenantId, reversalId, req.body ?? {})
  return sendSuccess(res, 'Dispatch reversal rejected', row)
})

export const cancelReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { cancelReversalRequest } = await import('./dispatch-reversal.service.js')
  const row = await cancelReversalRequest(req, tenantId, reversalId)
  return sendSuccess(res, 'Dispatch reversal cancelled', row)
})

export const applyReversal = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const reversalId = getRouteParam(req, 'reversalId')
  const { applyReversal } = await import('./dispatch-reversal.service.js')
  const force = Boolean(req.body?.force)
  const row = await applyReversal(req, tenantId, reversalId, { force })
  return sendSuccess(res, 'Dispatch reversal applied', row)
})

export const listDomainEvents = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { listDispatchDomainEvents } = await import('./dispatch-domain-events.service.js')
  const result = await listDispatchDomainEvents(tenantId, req.query as never)
  return sendSuccess(res, 'Dispatch domain events listed', result.items, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  })
})

export const getDomainEvent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const eventId = getRouteParam(req, 'eventId')
  const { getDispatchDomainEvent } = await import('./dispatch-domain-events.service.js')
  const row = await getDispatchDomainEvent(tenantId, eventId)
  return sendSuccess(res, 'Dispatch domain event fetched', row)
})

export const processDomainEvents = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { processPendingDomainEvents } = await import('./dispatch-domain-events.service.js')
  const result = await processPendingDomainEvents(tenantId, {
    limit: req.body?.limit,
    includeFailed: req.body?.includeFailed === true,
  })
  return sendSuccess(res, 'Dispatch domain outbox processed', result)
})

export const retryDomainEvent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const eventId = getRouteParam(req, 'eventId')
  const { retryDispatchDomainEvent } = await import('./dispatch-domain-events.service.js')
  const row = await retryDispatchDomainEvent(tenantId, eventId)
  return sendSuccess(res, 'Dispatch domain event retried', row)
})
