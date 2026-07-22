import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as service from './work-centre.service.js'
import type { CreateWorkCentreInput, ListWorkCentresQuery, UpdateWorkCentreInput } from './work-centre.schemas.js'
import type { ManufacturingWorkCentre } from '@prisma/client'

function mapWorkCentre(row: ManufacturingWorkCentre) {
  return {
    ...row,
    capacityPerShift: dec(row.capacityPerShift),
    costRate: dec(row.costRate),
  }
}

export const listWorkCentres = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(tenantId, req.query as unknown as ListWorkCentresQuery)
  return sendPaginated(
    res,
    'work centres listed',
    result.items.map(mapWorkCentre),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'work centre fetched', mapWorkCentre(item))
})

export const createWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body as CreateWorkCentreInput)
  return sendCreated(res, 'work centre created', mapWorkCentre(item))
})

export const updateWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body as UpdateWorkCentreInput)
  return sendSuccess(res, 'work centre updated', mapWorkCentre(item))
})

export const deleteWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, id)
  return sendSuccess(res, 'work centre deleted', null)
})

export const activateWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'work centre activated', mapWorkCentre(item))
})

export const deactivateWorkCentre = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'work centre deactivated', mapWorkCentre(item))
})
