import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './attendance.service.js'
import type {
  CreatePunchInput,
  FinalizeAttendanceDayInput,
  ListAttendanceDaysQuery,
  ListExceptionsQuery,
} from './attendance.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

export const listDays = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await service.listAttendanceDays(
    getTenantId(req),
    scope,
    req.query as unknown as ListAttendanceDaysQuery,
  )
  return sendPaginated(
    res,
    'Attendance days listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listExceptions = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await service.listAttendanceExceptions(
    getTenantId(req),
    scope,
    req.query as unknown as ListExceptionsQuery,
  )
  return sendPaginated(
    res,
    'Attendance exceptions listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const createPunch = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.createPunch(
    getTenantId(req),
    req.body as CreatePunchInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Punch recorded', item)
})

/** Locks the attendance day for OT purposes — refreshes worked time and regenerates its OT candidate. */
export const finalizeDay = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const body = req.body as FinalizeAttendanceDayInput
  const { finalizeAttendanceDay } = await import('../overtime/ot-detection.service.js')
  const item = await finalizeAttendanceDay(
    getTenantId(req),
    body.employeeId,
    body.date,
    scope,
    req.context?.userId,
    { ipAddress: req.ip, userAgent: req.get('user-agent') },
  )
  return sendSuccess(res, 'Attendance day finalized', item)
})
