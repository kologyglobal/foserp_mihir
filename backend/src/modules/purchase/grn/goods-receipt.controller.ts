import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './goods-receipt.service.js'

function getUserId(req: Request): string {
  return getContext(req).userId
}

export const listGoodsReceipts = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listGoodsReceipts(getTenantId(req), req.query as never)
  sendPaginated(
    res,
    'Goods receipts retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getGoodsReceipt(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Goods receipt retrieved', data)
})

export const previewNextGoodsReceiptNumber = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.previewNextGoodsReceiptNumber(getTenantId(req))
  sendSuccess(res, 'Next goods receipt number previewed', data)
})

export const createGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createGoodsReceipt(getTenantId(req), getUserId(req), req.body)
  sendSuccess(res, 'Goods receipt created', data, 201)
})

export const updateGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateGoodsReceipt(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body,
  )
  sendSuccess(res, 'Goods receipt updated', data)
})

export const submitGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.submitGoodsReceipt(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Goods receipt submitted', data)
})

export const cancelGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.cancelGoodsReceipt(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Goods receipt cancelled', data)
})

export const reverseGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.reverseGoodsReceipt(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Goods receipt reversed', data)
})

export const postInventoryGoodsReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.postInventoryGoodsReceipt(
    getTenantId(req),
    getRouteParam(req, 'id'),
    getUserId(req),
    req.body ?? {},
  )
  sendSuccess(res, 'Goods receipt inventory posted', data)
})

export const getReceivableLines = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getReceivableLines(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Receivable PO lines retrieved', data)
})
