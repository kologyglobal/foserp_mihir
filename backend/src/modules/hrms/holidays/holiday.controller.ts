import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './holiday.service.js'
import type {
  CreateCalendarInput,
  CreateHolidayDayInput,
  ListCalendarsQuery,
  UpdateCalendarInput,
  UpdateHolidayDayInput,
} from './holiday.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await service.listCalendars(
    getTenantId(req),
    req.query as unknown as ListCalendarsQuery,
    scope,
  )
  return sendPaginated(
    res,
    'Holiday calendars listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.getCalendar(getTenantId(req), getRouteParam(req, 'calendarId'), scope)
  return sendSuccess(res, 'Holiday calendar fetched', item)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.createCalendar(
    getTenantId(req),
    req.body as CreateCalendarInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Holiday calendar created', item)
})

export const update = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.updateCalendar(
    getTenantId(req),
    getRouteParam(req, 'calendarId'),
    req.body as UpdateCalendarInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Holiday calendar updated', item)
})

export const addDay = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.addHolidayDay(
    getTenantId(req),
    getRouteParam(req, 'calendarId'),
    req.body as CreateHolidayDayInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Holiday day added', item)
})

export const updateDay = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.updateHolidayDay(
    getTenantId(req),
    getRouteParam(req, 'calendarId'),
    getRouteParam(req, 'dayId'),
    req.body as UpdateHolidayDayInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Holiday day updated', item)
})

export const removeDay = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.removeHolidayDay(
    getTenantId(req),
    getRouteParam(req, 'calendarId'),
    getRouteParam(req, 'dayId'),
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Holiday day removed', item)
})

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const employeeId = String(req.query.employeeId)
  const date = String(req.query.date)
  const item = await service.resolveHolidayForEmployee(getTenantId(req), employeeId, date, scope)
  return sendSuccess(res, 'Holiday resolved', item)
})
