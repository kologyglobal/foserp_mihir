import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './traceability.service.js'
import type { TraceabilitySearchQueryInput } from './traceability.schemas.js'

export const search = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as TraceabilitySearchQueryInput
  const results = await service.searchTraceability(tenantId, query.query)
  return sendSuccess(res, 'Traceability search results', { results })
})

export const getLineage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const entityType = getRouteParam(req, 'entityType')
  const entityId = getRouteParam(req, 'entityId')
  const lineage = await service.getTraceabilityLineage(tenantId, entityType, entityId)
  return sendSuccess(res, 'Traceability lineage fetched', lineage)
})
