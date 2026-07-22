import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { exportCloseGateRunCsv } from './payable-close-gate-export.service.js'
import { getCloseGateRunDetail, getLatestCloseGateRun, listCloseGateRuns } from './payable-close-gate-read.service.js'
import { createCloseGateRun } from './payable-close-gate.service.js'
import type {
  CreateCloseGateRunBodyInput,
  LatestCloseGateQueryInput,
  ListCloseGateRunsQueryInput,
} from './payable-reconciliation.schemas.js'

export const createCloseGateRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CreateCloseGateRunBodyInput
  const result = await createCloseGateRun(tenantId, { tenantId, userId: req.context?.userId ?? null }, body)
  return sendCreated(res, 'AP close gate run created', result)
})

export const listCloseGateRunsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListCloseGateRunsQueryInput
  const result = await listCloseGateRuns(tenantId, query)
  return sendPaginated(res, 'AP close gate runs listed', result.items, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getCloseGateRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const result = await getCloseGateRunDetail(tenantId, runId)
  return sendSuccess(res, 'AP close gate run fetched', result)
})

export const getLatestCloseGateRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as LatestCloseGateQueryInput
  const result = await getLatestCloseGateRun(tenantId, query)
  return sendSuccess(res, 'Latest AP close gate run fetched', result)
})

export const exportCloseGateRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const csv = await exportCloseGateRunCsv(tenantId, runId)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="ap-close-gate-${runId}.csv"`)
  res.send(csv)
})
