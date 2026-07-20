import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendSuccess, sendPaginated, sendCreated } from '../../../utils/response.js'
import * as service from './purchase-planning.service.js'
import * as createPoService from './purchase-planning-create-po.service.js'

export const listPlanningSheet = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPlanningSheet(tenantId, req.query as never)
  sendPaginated(
    res,
    'Planning sheet retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPlanningSheetSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getPlanningSheetSummary(tenantId)
  sendSuccess(res, 'Planning sheet summary retrieved', data)
})

export const getPlanningRow = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getPlanningRow(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Planning sheet row retrieved', data)
})

export const updatePlanningRow = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updatePlanningRow(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Planning sheet row updated', data)
})

export const bulkAssignBuyer = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.bulkAssignBuyer(tenantId, userId, req.body)
  sendSuccess(res, 'Buyer assigned to planning rows', data)
})

export const bulkSelectVendor = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.bulkSelectVendor(tenantId, userId, req.body)
  sendSuccess(res, 'Vendor selected on planning rows', data)
})

export const bulkUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.bulkUpdateStatus(tenantId, userId, req.body)
  sendSuccess(res, 'Planning row status updated', data)
})

export const recalculatePlanningRows = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.recalculatePlanningRows(tenantId, userId, req.body ?? { rowIds: [] })
  sendSuccess(res, 'Planning rows recalculated', data)
})

export const createPurchaseOrdersFromPlanning = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await createPoService.createPurchaseOrdersFromPlanning(tenantId, userId, req.body)
  sendCreated(res, 'Purchase orders created from planning', data)
})
