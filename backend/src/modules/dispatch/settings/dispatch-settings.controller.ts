import type { Request, Response } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './dispatch-settings.service.js'
import type { UpdateDispatchSettingsInput } from './dispatch-settings.schemas.js'

function tenantId(req: Request): string {
  return req.context!.tenantId
}

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getDispatchCommercialSettings(req, tenantId(req))
  sendSuccess(res, 'Dispatch settings', data)
})

export const putSettings = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateDispatchCommercialSettings(
    req,
    tenantId(req),
    req.body as UpdateDispatchSettingsInput,
  )
  sendSuccess(res, 'Dispatch settings updated', data)
})
