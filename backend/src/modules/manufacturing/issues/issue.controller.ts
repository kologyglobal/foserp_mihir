import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { isoDate } from '../shared/manufacturing.mappers.js'
import * as service from './issue.service.js'
import type {
  AcknowledgeIssueInput,
  CancelIssueInput,
  ListIssuesQuery,
  ReportIssueInput,
  ResolveIssueInput,
} from './issue.schemas.js'

function mapIssue(row: Record<string, unknown>) {
  return {
    ...row,
    startedAt: isoDate(row.startedAt as Date),
    acknowledgedAt: isoDate(row.acknowledgedAt as Date | null),
    resolvedAt: isoDate(row.resolvedAt as Date | null),
    createdAt: isoDate(row.createdAt as Date),
    updatedAt: isoDate(row.updatedAt as Date),
  }
}

export const reportIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.reportIssue(req, tenantId, req.body as ReportIssueInput)
  return sendCreated(res, 'Issue reported', mapIssue(item as never))
})

export const listIssues = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listIssues(tenantId, req.query as unknown as ListIssuesQuery)
  return sendPaginated(
    res,
    'Issues listed',
    result.items.map((item) => mapIssue(item as never)),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getIssue(tenantId, id)
  return sendSuccess(res, 'Issue fetched', mapIssue(item as never))
})

export const acknowledgeIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.acknowledgeIssue(req, tenantId, id, req.body as AcknowledgeIssueInput)
  return sendSuccess(res, 'Issue acknowledged', mapIssue(item as never))
})

export const markIssueInProgress = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.markIssueInProgress(req, tenantId, id)
  return sendSuccess(res, 'Issue marked in progress', mapIssue(item as never))
})

export const resolveIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.resolveIssue(req, tenantId, id, req.body as ResolveIssueInput)
  return sendSuccess(res, 'Issue resolved', mapIssue(item as never))
})

export const cancelIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelIssue(req, tenantId, id, req.body as CancelIssueInput)
  return sendSuccess(res, 'Issue cancelled', mapIssue(item as never))
})
