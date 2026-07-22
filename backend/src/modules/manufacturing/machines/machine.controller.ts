import type { Request, Response } from 'express'
import type { ManufacturingMachine } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as service from './machine.service.js'
import type {
  CreateMachineInput,
  ListMachinesQuery,
  SetMachineStatusInput,
  UpdateMachineInput,
} from './machine.schemas.js'

function mapMachine(row: ManufacturingMachine) {
  return { ...row, capacity: dec(row.capacity), costRate: dec(row.costRate) }
}

export const listMachines = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRecords(tenantId, req.query as unknown as ListMachinesQuery)
  return sendPaginated(
    res,
    'machines listed',
    result.items.map(mapMachine),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, id)
  return sendSuccess(res, 'machine fetched', mapMachine(item))
})

export const createMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecord(req, tenantId, req.body as CreateMachineInput)
  return sendCreated(res, 'machine created', mapMachine(item))
})

export const updateMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateRecord(req, tenantId, id, req.body as UpdateMachineInput)
  return sendSuccess(res, 'machine updated', mapMachine(item))
})

export const deleteMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  await service.deleteRecord(req, tenantId, id)
  return sendSuccess(res, 'machine deleted', null)
})

export const activateMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.activateRecord(req, tenantId, id)
  return sendSuccess(res, 'machine activated', mapMachine(item))
})

export const deactivateMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.deactivateRecord(req, tenantId, id)
  return sendSuccess(res, 'machine deactivated', mapMachine(item))
})

export const setMachineStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.setStatus(req, tenantId, id, req.body as SetMachineStatusInput)
  return sendSuccess(res, 'machine status updated', mapMachine(item))
})
