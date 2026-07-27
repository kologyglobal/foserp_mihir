import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../utils/response.js'
import * as service from './dashboard.service.js'

export const listWidgets = asyncHandler(async (req: Request, res: Response) => {
  const { permissions } = getContext(req)
  const data = service.listWidgetCatalog(permissions)
  sendSuccess(res, 'Widget catalog retrieved', data)
})

export const queryWidget = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { permissions } = getContext(req)
  const data = await service.queryWidgetData(tenantId, permissions, req.body)
  sendSuccess(res, 'Widget query completed', data)
})

export const listDashboards = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const data = await service.listDashboards(tenantId, userId, permissions)
  sendSuccess(res, 'Dashboards retrieved', data)
})

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const data = await service.getDashboard(tenantId, userId, getRouteParam(req, 'id'), permissions)
  sendSuccess(res, 'Dashboard retrieved', data)
})

export const createDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const data = await service.createDashboard(tenantId, userId, permissions, req.body)
  sendCreated(res, 'Dashboard created', data)
})

export const updateDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const data = await service.updateDashboard(
    tenantId,
    userId,
    permissions,
    getRouteParam(req, 'id'),
    req.body,
  )
  sendSuccess(res, 'Dashboard updated', data)
})

export const deleteDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.deleteDashboard(tenantId, userId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Dashboard deleted', data)
})

export const duplicateDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.duplicateDashboard(tenantId, userId, getRouteParam(req, 'id'))
  sendCreated(res, 'Dashboard duplicated', data)
})

export const setDefaultDashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.setDefaultDashboard(tenantId, userId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Default dashboard set', data)
})
