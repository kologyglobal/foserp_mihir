import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as service from './saved-view.service.js'
import type { CreateSavedViewInput, ListSavedViewsQueryInput, UpdateSavedViewInput } from './saved-view.schemas.js'

export const listSavedViews = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const query = req.query as unknown as ListSavedViewsQueryInput
  const views = await service.listSavedViews(tenantId, userId, permissions, query.reportKey)
  return sendSuccess(res, 'Saved report views listed', { views })
})

export const getSavedView = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const id = getRouteParam(req, 'id')
  const view = await service.getSavedView(tenantId, userId, permissions, id)
  return sendSuccess(res, 'Saved report view fetched', view)
})

export const createSavedView = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const body = req.body as CreateSavedViewInput
  const view = await service.createSavedView(tenantId, userId, permissions, body)
  return sendCreated(res, 'Saved report view created', view)
})

export const updateSavedView = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId, permissions } = getContext(req)
  const id = getRouteParam(req, 'id')
  const body = req.body as UpdateSavedViewInput
  const view = await service.updateSavedView(tenantId, userId, permissions, id, body)
  return sendSuccess(res, 'Saved report view updated', view)
})

export const deleteSavedView = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const id = getRouteParam(req, 'id')
  await service.deleteSavedView(tenantId, userId, id)
  return sendSuccess(res, 'Saved report view deleted', { id })
})

export const setDefaultSavedView = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const id = getRouteParam(req, 'id')
  const view = await service.setDefaultSavedView(tenantId, userId, id)
  return sendSuccess(res, 'Saved report view set as default', view)
})
