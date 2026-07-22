import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import { getFgEligibility } from './fg-eligibility.service.js'
import * as service from './fg-receipt.service.js'
import type { PostFgReceiptInput, PreviewFgReceiptInput } from './fg-receipt.schemas.js'

function workOrderId(req: Request): string {
  return getRouteParam(req, 'id')
}

export const getEligibility = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FG eligibility fetched', await getFgEligibility(getTenantId(req), workOrderId(req))),
)

export const list = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'FG receipts listed', await service.listFgReceipts(getTenantId(req), workOrderId(req))),
)

export const preview = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'FG receipt preview',
    await service.previewFgReceipt(
      getTenantId(req),
      workOrderId(req),
      (req.body ?? {}) as PreviewFgReceiptInput,
    ),
  ),
)

export const createDraft = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'FG receipt draft created',
    await service.createFgDraft(req, getTenantId(req), workOrderId(req), req.body as PostFgReceiptInput),
  ),
)

export const post = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'FG receipt posted',
    await service.postFinishedGoodsReceipt(
      req,
      getTenantId(req),
      workOrderId(req),
      req.body as PostFgReceiptInput,
    ),
  ),
)

export const getById = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'FG receipt fetched',
    await service.getFgReceipt(getTenantId(req), getRouteParam(req, 'receiptId')),
  ),
)
