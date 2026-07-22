import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../../utils/response.js'
import { postVendorInvoiceFromRequest } from './vendor-invoice-posting.service.js'
import {
  getVendorInvoiceReversalPreview,
  reverseVendorInvoiceFromRequest,
} from './vendor-invoice-reverse.service.js'

export const postVendorInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await postVendorInvoiceFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor invoice posted', result)
})

export const getVendorInvoiceReversalPreviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await getVendorInvoiceReversalPreview(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'vendor invoice reversal preview', result)
})

export const reverseVendorInvoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await reverseVendorInvoiceFromRequest(
    req,
    getTenantId(req),
    getRouteParam(req, 'id'),
    req.body,
  )
  return sendSuccess(res, 'vendor invoice reversed', result)
})
