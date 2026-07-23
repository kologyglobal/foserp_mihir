import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './setup.service.js'
import * as lookup from './lookup.service.js'

export const getInventorySetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getInventorySetup(getTenantId(req))
  sendSuccess(res, 'Inventory setup retrieved', data)
})

export const putInventorySetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.upsertInventorySetup(getTenantId(req), getContext(req).userId, req.body)
  sendSuccess(res, 'Inventory setup saved', data)
})

export const lookupInventoryCode = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.query.code ?? '')
  const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined
  const data = await lookup.lookupInventoryCode(getTenantId(req), code, warehouseId)
  sendSuccess(res, 'Inventory lookup completed', data)
})
