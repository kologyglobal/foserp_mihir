import type { Request, Response } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { auditFromRequest } from '../../../services/audit.service.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './designation.service.js'
import type { CreateDesignationInput, ListDesignationsQuery, UpdateDesignationInput } from './designation.schemas.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const result = await service.listDesignations(tenantId, scope, req.query as unknown as ListDesignationsQuery)
  return sendPaginated(res, 'Designations listed', result.items, result.meta)
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.getDesignation(tenantId, scope, getRouteParam(req, 'designationId'))
  return sendSuccess(res, 'Designation fetched', item)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.createDesignation(tenantId, scope, req.body as CreateDesignationInput, auditFromRequest(req))
  return sendCreated(res, 'Designation created', item)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const scope = await loadHrScope(req)
  const item = await service.updateDesignation(
    tenantId,
    scope,
    getRouteParam(req, 'designationId'),
    req.body as UpdateDesignationInput,
    auditFromRequest(req),
  )
  return sendSuccess(res, 'Designation updated', item)
})
