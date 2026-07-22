import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './requisition.service.js'
import type {
  CancelRequisitionInput,
  CreateRequisitionInput,
  FromProductionShortageInput,
  ListRequisitionsQuery,
  RejectRequisitionInput,
  RequisitionLineInput,
  UpdateRequisitionInput,
  UpdateRequisitionLineInput,
} from './requisition.schemas.js'

export const listRequisitions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRequisitions(tenantId, req.query as unknown as ListRequisitionsQuery)
  return sendPaginated(
    res,
    'Purchase requisitions listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const requisition = await service.createRequisition(req, tenantId, req.body as CreateRequisitionInput)
  return sendCreated(res, 'Purchase requisition created', requisition)
})

export const createFromProductionShortage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const requisition = await service.createFromProductionShortage(req, tenantId, req.body as FromProductionShortageInput)
  return sendCreated(res, 'Purchase requisition created from production shortage', requisition)
})

export const listByProductionOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const productionOrderId = getRouteParam(req, 'productionOrderId')
  const items = await service.listByProductionOrder(tenantId, productionOrderId)
  return sendSuccess(res, 'Purchase requisitions listed for production order', items)
})

export const getRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.getRequisition(tenantId, id)
  return sendSuccess(res, 'Purchase requisition fetched', requisition)
})

export const updateRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.updateRequisition(req, tenantId, id, req.body as UpdateRequisitionInput)
  return sendSuccess(res, 'Purchase requisition updated', requisition)
})

export const addLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.addLine(req, tenantId, id, req.body as RequisitionLineInput)
  return sendSuccess(res, 'Purchase requisition line added', requisition)
})

export const updateLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const lineId = getRouteParam(req, 'lineId')
  const requisition = await service.updateLine(req, tenantId, lineId, req.body as UpdateRequisitionLineInput)
  return sendSuccess(res, 'Purchase requisition line updated', requisition)
})

export const deleteLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const lineId = getRouteParam(req, 'lineId')
  const requisition = await service.deleteLine(req, tenantId, lineId)
  return sendSuccess(res, 'Purchase requisition line deleted', requisition)
})

export const submitRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.submitRequisition(req, tenantId, id)
  return sendSuccess(res, 'Purchase requisition submitted', requisition)
})

export const approveRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.approveRequisition(req, tenantId, id)
  return sendSuccess(res, 'Purchase requisition approved', requisition)
})

export const rejectRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.rejectRequisition(req, tenantId, id, req.body as RejectRequisitionInput)
  return sendSuccess(res, 'Purchase requisition rejected', requisition)
})

export const cancelRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const requisition = await service.cancelRequisition(req, tenantId, id, req.body as CancelRequisitionInput)
  return sendSuccess(res, 'Purchase requisition cancelled', requisition)
})
