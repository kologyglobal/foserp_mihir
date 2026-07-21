import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './purchase-invoice.service.js'

const actor = (req: Request) => getContext(req).userId

export const listPurchaseInvoices = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listPurchaseInvoices(getTenantId(req), req.query as never)
  sendPaginated(res, 'Purchase invoices retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const getPurchaseInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase invoice retrieved', await service.getPurchaseInvoice(getTenantId(req), getRouteParam(req, 'id'))))
export const createPurchaseInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase invoice created', await service.createPurchaseInvoice(getTenantId(req), actor(req), req.body), 201))
export const updatePurchaseInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Purchase invoice updated', await service.updatePurchaseInvoice(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body)))

const lifecycle = (fn: typeof service.approvePurchaseInvoice, message: string) =>
  asyncHandler(async (req: Request, res: Response) =>
    sendSuccess(res, message, await fn(getTenantId(req), getRouteParam(req, 'id'), actor(req), req.body ?? {})))

export const submitPurchaseInvoice = lifecycle(service.submitPurchaseInvoice, 'Purchase invoice submitted')
export const approvePurchaseInvoice = lifecycle(service.approvePurchaseInvoice, 'Purchase invoice approved')
export const rejectPurchaseInvoice = lifecycle(service.rejectPurchaseInvoice, 'Purchase invoice rejected')
export const postPurchaseInvoice = lifecycle(service.postPurchaseInvoice, 'Purchase invoice posted')
export const cancelPurchaseInvoice = lifecycle(service.cancelPurchaseInvoice, 'Purchase invoice cancelled')
