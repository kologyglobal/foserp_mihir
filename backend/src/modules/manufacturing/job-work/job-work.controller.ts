import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './job-work.service.js'
import type { CreateJobWorkInput, DispatchJobWorkInput, ReceiveJobWorkInput, ReconcileInput, ReturnMaterialInput, UpdateJobWorkInput } from './job-work.schemas.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(getTenantId(req), req.query as { status?: string; vendorId?: string; productionOrderId?: string; search?: string; page?: number; limit?: number })
  return sendPaginated(res, 'Job work orders listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
export const get = asyncHandler(async (req, res) => sendSuccess(res, 'Job work order fetched', await service.get(getTenantId(req), getRouteParam(req, 'id'))))
export const create = asyncHandler(async (req, res) => sendCreated(res, 'Job work order created', await service.create(req, getTenantId(req), req.body as CreateJobWorkInput)))
export const update = asyncHandler(async (req, res) => sendSuccess(res, 'Job work order updated', await service.update(req, getTenantId(req), getRouteParam(req, 'id'), req.body as UpdateJobWorkInput)))
export const dispatch = asyncHandler(async (req, res) => sendSuccess(res, 'Material dispatched', await service.dispatch(req, getTenantId(req), getRouteParam(req, 'id'), req.body as DispatchJobWorkInput)))
export const receive = asyncHandler(async (req, res) => sendSuccess(res, 'Job work receipt recorded', await service.receive(req, getTenantId(req), getRouteParam(req, 'id'), req.body as ReceiveJobWorkInput)))
export const returnMaterial = asyncHandler(async (req, res) => sendSuccess(res, 'Material return recorded', await service.returnMaterial(req, getTenantId(req), getRouteParam(req, 'id'), req.body as ReturnMaterialInput)))
export const reconcile = asyncHandler(async (req, res) => sendSuccess(res, 'Job work reconciled', await service.reconcile(req, getTenantId(req), getRouteParam(req, 'id'), req.body as ReconcileInput)))
export const approveDifference = asyncHandler(async (req, res) => sendSuccess(res, 'Difference approved', await service.approveDifference(req, getTenantId(req), getRouteParam(req, 'id'), req.body.reason)))
export const linkInvoice = asyncHandler(async (req, res) => sendSuccess(res, 'Vendor invoice linked', await service.linkInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))
export const close = asyncHandler(async (req, res) => sendSuccess(res, 'Job work order closed', await service.close(req, getTenantId(req), getRouteParam(req, 'id'))))
export const cancel = asyncHandler(async (req, res) => sendSuccess(res, 'Job work order cancelled', await service.cancel(req, getTenantId(req), getRouteParam(req, 'id'), req.body.reason)))
