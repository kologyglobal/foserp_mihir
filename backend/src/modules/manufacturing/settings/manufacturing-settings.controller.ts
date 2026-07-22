import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './manufacturing-settings.service.js'

export const getManufacturingSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getManufacturingSettings(getTenantId(req))
  sendSuccess(res, 'Manufacturing settings retrieved', data)
})

export const putManufacturingSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.upsertManufacturingSettings(
    getTenantId(req),
    getContext(req).userId,
    req.body,
  )
  sendSuccess(res, 'Manufacturing settings saved', data)
})

export const patchManufacturingSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.patchManufacturingSettings(
    getTenantId(req),
    getContext(req).userId,
    req.body,
  )
  sendSuccess(res, 'Manufacturing settings updated', data)
})
