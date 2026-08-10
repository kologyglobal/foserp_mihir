import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import * as service from './ui-preference.service.js'
import type { PutUiPreferenceInput } from './ui-preference.validation.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const items = await service.listUiPreferences(tenantId, userId)
  sendSuccess(res, 'UI preferences', items)
})

export const put = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const prefKey = getRouteParam(req, 'prefKey')
  const { value } = req.body as PutUiPreferenceInput
  const item = await service.putUiPreference(tenantId, userId, prefKey, value)
  sendSuccess(res, 'UI preference saved', item)
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const prefKey = getRouteParam(req, 'prefKey')
  await service.deleteUiPreference(tenantId, userId, prefKey)
  sendSuccess(res, 'UI preference removed', { prefKey })
})
