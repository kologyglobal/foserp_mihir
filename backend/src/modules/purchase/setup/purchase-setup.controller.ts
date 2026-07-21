import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-setup.service.js'

function getUserId(req: Request): string {
  return getContext(req).userId
}

export const getPurchaseSetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getPurchaseSetup(getTenantId(req))
  sendSuccess(res, 'Purchase setup retrieved', data)
})

export const putPurchaseSetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.upsertPurchaseSetup(getTenantId(req), getUserId(req), req.body)
  sendSuccess(res, 'Purchase setup saved', data)
})

export const patchPurchaseSetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.patchPurchaseSetup(getTenantId(req), getUserId(req), req.body)
  sendSuccess(res, 'Purchase setup updated', data)
})

export const listPurchasePlantSetups = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listPurchasePlantSetups(getTenantId(req))
  sendSuccess(res, 'Purchase plant setups retrieved', data)
})

export const getPurchasePlantSetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getPurchasePlantSetup(getTenantId(req), getRouteParam(req, 'plantId'))
  sendSuccess(res, 'Purchase plant setup retrieved', data)
})

export const putPurchasePlantSetup = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.upsertPurchasePlantSetup(
    getTenantId(req),
    getRouteParam(req, 'plantId'),
    getUserId(req),
    req.body,
  )
  sendSuccess(res, 'Purchase plant setup saved', data)
})
