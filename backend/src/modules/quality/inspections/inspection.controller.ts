import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './inspection.service.js'
import type {
  CancelInspectionInput,
  CreateInspectionInput,
  DecideInspectionInput,
  ListInspectionsQuery,
} from './inspection.schemas.js'

export const listInspections = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listInspections(tenantId, req.query as unknown as ListInspectionsQuery)
  return sendPaginated(
    res,
    'Quality inspections listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createInspection = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const inspection = await service.createInspection(req, tenantId, req.body as CreateInspectionInput)
  return sendCreated(res, 'Quality inspection created', inspection)
})

export const getInspection = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const inspection = await service.getInspection(tenantId, id)
  return sendSuccess(res, 'Quality inspection fetched', inspection)
})

export const decideInspection = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.decideInspection(req, tenantId, id, req.body as DecideInspectionInput)
  return sendSuccess(res, 'Quality inspection decided', result)
})

export const cancelInspection = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const inspection = await service.cancelInspection(req, tenantId, id, req.body as CancelInspectionInput)
  return sendSuccess(res, 'Quality inspection cancelled', inspection)
})
