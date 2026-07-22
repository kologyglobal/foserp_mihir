import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../../utils/response.js'
import { postVendorPaymentFromRequest } from './vendor-payment-posting.service.js'
import {
  getVendorPaymentReversalPreview,
  reverseVendorPaymentFromRequest,
} from './vendor-payment-reverse.service.js'

export const postVendorPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await postVendorPaymentFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor payment posted', result)
})

export const getVendorPaymentReversalPreviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getVendorPaymentReversalPreview(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'vendor payment reversal preview', result)
})

export const reverseVendorPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await reverseVendorPaymentFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor payment reversed', result)
})
