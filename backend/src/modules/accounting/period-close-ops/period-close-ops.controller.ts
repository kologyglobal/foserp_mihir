import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import type { ListReopenRequestsQuery, ListTemplatesQuery } from './period-close-ops.schemas.js'
import * as service from './period-close-ops.service.js'

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listTemplates(getTenantId(req), req.query as unknown as ListTemplatesQuery)
  return sendPaginated(res, 'checklist templates listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createTemplate = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'checklist template created', await service.createTemplate(req, getTenantId(req), req.body)))

export const updateTemplate = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'checklist template updated', await service.updateTemplate(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const archiveTemplate = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'checklist template archived', await service.archiveTemplate(req, getTenantId(req), getRouteParam(req, 'id'))))

export const listChecklistTasks = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'checklist tasks listed', await service.listChecklistTasks(getTenantId(req), getRouteParam(req, 'periodId'))))

export const instantiateChecklist = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'checklist instantiated', await service.instantiateChecklist(req, getTenantId(req), getRouteParam(req, 'periodId'))))

export const updateChecklistTask = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'checklist task updated', await service.updateChecklistTask(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const listCalendarEvents = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'calendar events listed', await service.listCalendarEvents(getTenantId(req), getRouteParam(req, 'periodId'))))

export const createCalendarEvent = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'calendar event created', await service.createCalendarEvent(req, getTenantId(req), getRouteParam(req, 'periodId'), req.body)))

export const generateCalendar = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'calendar generated', await service.generateCalendar(req, getTenantId(req), getRouteParam(req, 'periodId'))))

export const updateCalendarEvent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'calendar event updated', await service.updateCalendarEvent(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const deleteCalendarEvent = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'calendar event deleted', await service.deleteCalendarEvent(req, getTenantId(req), getRouteParam(req, 'id'))))

export const listReopenRequests = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listReopenRequests(getTenantId(req), req.query as unknown as ListReopenRequestsQuery)
  return sendPaginated(res, 'reopen requests listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'reopen request created', await service.createReopenRequest(req, getTenantId(req), req.body)))

export const getReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request fetched', await service.getReopenRequest(getTenantId(req), getRouteParam(req, 'id'))))

export const submitReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request submitted', await service.submitReopenRequest(req, getTenantId(req), getRouteParam(req, 'id'))))

export const approveReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request approved', await service.approveReopenRequest(req, getTenantId(req), getRouteParam(req, 'id'), req.body ?? {})))

export const rejectReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request rejected', await service.rejectReopenRequest(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request cancelled', await service.cancelReopenRequest(req, getTenantId(req), getRouteParam(req, 'id'))))

export const closeReopenRequest = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'reopen request closed', await service.closeReopenRequest(req, getTenantId(req), getRouteParam(req, 'id'))))
