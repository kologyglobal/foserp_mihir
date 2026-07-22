import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './inspection-plan.service.js'
import type {
  CreatePlanInput,
  ListPlansQuery,
  ReplacePlanLinesInput,
  UpdatePlanInput,
} from './inspection-plan.schemas.js'

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPlans(tenantId, req.query as unknown as ListPlansQuery)
  return sendPaginated(
    res,
    'Inspection plans listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.getPlan(tenantId, id)
  return sendSuccess(res, 'Inspection plan fetched', row)
})

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const row = await service.createPlan(req, tenantId, req.body as CreatePlanInput)
  return sendCreated(res, 'Inspection plan created', row)
})

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.updatePlan(req, tenantId, id, req.body as UpdatePlanInput)
  return sendSuccess(res, 'Inspection plan updated', row)
})

export const replacePlanLines = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.replacePlanLines(req, tenantId, id, req.body as ReplacePlanLinesInput)
  return sendSuccess(res, 'Inspection plan lines replaced', row)
})

export const deactivatePlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const row = await service.deactivatePlan(req, tenantId, id)
  return sendSuccess(res, 'Inspection plan deactivated', row)
})

export const revisePlan = asyncHandler(async (req: Request, res: Response) => {
  const row = await service.revisePlan(req, getTenantId(req), getRouteParam(req, 'id'), req.body)
  return sendCreated(res, 'Inspection plan revision created', row)
})
export const activatePlan = asyncHandler(async (req: Request, res: Response) => {
  const row = await service.activatePlan(req, getTenantId(req), getRouteParam(req, 'id'))
  return sendSuccess(res, 'Inspection plan activated', row)
})
export const listRevisions = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Inspection plan revisions listed', await service.listRevisions(getTenantId(req), getRouteParam(req, 'id'))))
