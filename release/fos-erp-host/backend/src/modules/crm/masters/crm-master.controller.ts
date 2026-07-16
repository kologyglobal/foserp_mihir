import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './crm-master.service.js'
import type { CrmMasterKind } from './crm-master.constants.js'
import type { CreateCrmMasterInput, ListCrmMastersQuery, UpdateCrmMasterInput } from './crm-master.validation.js'

export const listMasters = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const result = await service.listMasters(tenantId, kind, req.query as unknown as ListCrmMastersQuery)
  sendPaginated(res, 'CRM masters retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const lookupMasters = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.lookupMasters(tenantId, kind)
  sendSuccess(res, 'CRM master lookup retrieved', data)
})

export const getMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.getMaster(tenantId, kind, getRouteParam(req, 'id'))
  sendSuccess(res, 'CRM master retrieved', data)
})

export const createMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.createMaster(req, tenantId, kind, req.body as CreateCrmMasterInput)
  sendCreated(res, 'CRM master created', data)
})

export const updateMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.updateMaster(req, tenantId, kind, getRouteParam(req, 'id'), req.body as UpdateCrmMasterInput)
  sendSuccess(res, 'CRM master updated', data)
})

export const deleteMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  await service.deleteMaster(req, tenantId, kind, getRouteParam(req, 'id'))
  sendSuccess(res, 'CRM master deleted', null)
})

export const activateMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.activateMaster(req, tenantId, kind, getRouteParam(req, 'id'))
  sendSuccess(res, 'CRM master activated', data)
})

export const deactivateMaster = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const kind = getRouteParam(req, 'kind') as CrmMasterKind
  const data = await service.deactivateMaster(req, tenantId, kind, getRouteParam(req, 'id'))
  sendSuccess(res, 'CRM master deactivated', data)
})

export const syncAllMasters = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.listAllMastersForSync(tenantId)
  sendSuccess(res, 'CRM masters sync data retrieved', data)
})
