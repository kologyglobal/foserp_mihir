import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as service from './pm.service.js'
import type {
  CreatePmPlanInput,
  CreatePmTicketInput,
  ListPmPlansQuery,
  PmComplianceQuery,
  UpdatePmPlanInput,
} from './pm.schemas.js'

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listPlans(tenantId, req.query as unknown as ListPmPlansQuery)
  return sendPaginated(
    res,
    'Preventive maintenance plans listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.getPlan(tenantId, getRouteParam(req, 'id'))
  return sendSuccess(res, 'Preventive maintenance plan fetched', item)
})

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createPlan(req, tenantId, req.body as CreatePmPlanInput)
  return sendCreated(res, 'Preventive maintenance plan created', item)
})

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.updatePlan(
    req,
    tenantId,
    getRouteParam(req, 'id'),
    req.body as UpdatePmPlanInput,
  )
  return sendSuccess(res, 'Preventive maintenance plan updated', item)
})

export const deactivatePlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.deactivatePlan(req, tenantId, getRouteParam(req, 'id'))
  return sendSuccess(res, 'Preventive maintenance plan deactivated', item)
})

export const createTicketFromPlan = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createTicketFromPlan(
    req,
    tenantId,
    getRouteParam(req, 'id'),
    req.body as CreatePmTicketInput,
  )
  return sendCreated(res, 'Preventive maintenance ticket created', item)
})

export const machinePlans = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.listPlansForMachine(tenantId, getRouteParam(req, 'machineId'))
  return sendSuccess(res, 'Machine preventive plans', items)
})

export const pmCompliance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getPmCompliance(tenantId, req.query as unknown as PmComplianceQuery)
  return sendSuccess(res, 'PM compliance report', data)
})
