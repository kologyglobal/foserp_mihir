import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../../utils/response.js'
import { postVendorAdjustmentFromRequest } from './vendor-adjustment-posting.service.js'
import {
  getVendorAdjustmentReversalPreview,
  reverseVendorAdjustmentFromRequest,
} from './vendor-adjustment-reverse.service.js'

export const postVendorAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const result = await postVendorAdjustmentFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor invoice posted', result)
})

export const getVendorAdjustmentReversalPreviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getVendorAdjustmentReversalPreview(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'vendor invoice reversal preview', result)
})

export const reverseVendorAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const result = await reverseVendorAdjustmentFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor invoice reversed', result)
})
