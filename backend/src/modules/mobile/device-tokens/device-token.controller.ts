import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './device-token.service.js'
import type { RegisterDeviceTokenInput, RevokeDeviceTokenInput } from './device-token.validation.js'

export const register = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const body = req.body as RegisterDeviceTokenInput
  const data = await service.registerDeviceToken(tenantId, userId, body)
  sendSuccess(res, 'Device token registered', data)
})

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const body = req.body as RevokeDeviceTokenInput
  const data = await service.revokeDeviceToken(tenantId, userId, body)
  sendSuccess(res, 'Device token revoked', data)
})
