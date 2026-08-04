import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-return.service.js'
const actor = (req: Request) => getContext(req).userId
export const listPurchaseReturns = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPurchaseReturns(getTenantId(req), req.query as never)
  sendPaginated(res, 'Purchase returns retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getReturnWizardPrefill = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Return wizard prefill',
    await service.getReturnWizardPrefill(getTenantId(req), {
      qualityInspectionId: typeof req.query.qualityInspectionId === 'string' ? req.query.qualityInspectionId : undefined,
      goodsReceiptId: typeof req.query.goodsReceiptId === 'string' ? req.query.goodsReceiptId : undefined,
    }),
  ))
export const getTrace = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Supplier quality trace',
    await service.getSupplierQualityTrace(getTenantId(req), {
      purchaseReturnId: typeof req.query.purchaseReturnId === 'string' ? req.query.purchaseReturnId : undefined,
      qualityInspectionId: typeof req.query.qualityInspectionId === 'string' ? req.query.qualityInspectionId : undefined,
      goodsReceiptId: typeof req.query.goodsReceiptId === 'string' ? req.query.goodsReceiptId : undefined,
    }),
  ))
export const getPurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return retrieved', await service.getPurchaseReturn(getTenantId(req), getRouteParam(req, 'id'))))
export const createPurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return created', await service.createPurchaseReturn(getTenantId(req), actor(req), req.body), 201))
export const updatePurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return updated', await service.updatePurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))
export const submitPurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return submitted', await service.submitPurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const approvePurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return approved', await service.approvePurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const shipPurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return shipped', await service.shipPurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const completePurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return completed', await service.completePurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const cancelPurchaseReturn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase return cancelled', await service.cancelPurchaseReturn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))
export const getPurchaseReturnApAdjustmentPreview = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'AP adjustment preview retrieved', await service.getPurchaseReturnApAdjustmentPreview(getTenantId(req), getRouteParam(req, 'id'))))
export const createPurchaseReturnApAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'AP adjustment draft created', await service.createPurchaseReturnApAdjustment(getTenantId(req), getRouteParam(req, 'id'), actor(req))))
export const linkReplacementGrn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Replacement GRN linked',
    await service.linkReplacementGoodsReceipt(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body.goodsReceiptId),
  ))
