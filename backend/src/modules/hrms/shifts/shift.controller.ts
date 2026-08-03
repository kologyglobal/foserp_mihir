import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './shift.service.js'
import type { CreateShiftInput, ListShiftsQuery, UpdateShiftInput } from './shift.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await service.listShifts(getTenantId(req), req.query as unknown as ListShiftsQuery, scope)
  return sendPaginated(
    res,
    'Shifts listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.getShift(getTenantId(req), getRouteParam(req, 'shiftId'), scope)
  return sendSuccess(res, 'Shift fetched', item)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.createShift(
    getTenantId(req),
    req.body as CreateShiftInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Shift created', item)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.updateShift(
    getTenantId(req),
    getRouteParam(req, 'shiftId'),
    req.body as UpdateShiftInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Shift updated', item)
})
