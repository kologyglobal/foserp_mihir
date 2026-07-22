import type { Request, Response } from 'express'
import type { ManufacturingProfile } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as service from './profile.service.js'
import type { CreateProfileInput, ListProfilesQuery, UpdateProfileInput } from './profile.schemas.js'

function mapProfile(row: ManufacturingProfile) {
  return {
    ...row,
    overproductionTolerancePercent: dec(row.overproductionTolerancePercent),
    underproductionTolerancePercent: dec(row.underproductionTolerancePercent),
  }
}

export const listProfiles = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listProfiles(tenantId, req.query as unknown as ListProfilesQuery)
  return sendPaginated(
    res,
    'Manufacturing profiles listed',
    result.items.map(mapProfile),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getProfile(tenantId, id)
  return sendSuccess(res, 'Manufacturing profile fetched', mapProfile(item))
})

export const createProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createProfile(req, tenantId, req.body as CreateProfileInput)
  return sendCreated(res, 'Manufacturing profile created', mapProfile(item))
})

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateProfile(req, tenantId, id, req.body as UpdateProfileInput)
  return sendSuccess(res, 'Manufacturing profile updated', mapProfile(item))
})

export const deleteProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteProfile(req, tenantId, id)
  return sendSuccess(res, 'Manufacturing profile deleted', null)
})

export const activateProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateProfile(req, tenantId, id)
  return sendSuccess(res, 'Manufacturing profile activated', mapProfile(item))
})

export const deactivateProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateProfile(req, tenantId, id)
  return sendSuccess(res, 'Manufacturing profile deactivated', mapProfile(item))
})

export const getProfileReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.getProfileReadiness(tenantId, id)
  return sendSuccess(res, 'Manufacturing profile readiness fetched', result)
})
