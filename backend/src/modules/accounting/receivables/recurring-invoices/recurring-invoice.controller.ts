import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../../utils/response.js'
import * as service from './recurring-invoice.service.js'
import * as generationService from './recurring-invoice-generation.service.js'
import type {
  CancelRecurringScheduleInput,
  CreateRecurringScheduleInput,
  ListRecurringSchedulesQueryInput,
  ListUpcomingInvoicesQueryInput,
} from './recurring-invoice.schemas.js'

export const createRecurringSchedule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRecurringSchedule(req, tenantId, req.body as CreateRecurringScheduleInput)
  return sendCreated(res, 'recurring invoice schedule created', item)
})

export const listRecurringSchedules = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListRecurringSchedulesQueryInput
  const items = await service.listRecurringSchedules(tenantId, query)
  return sendSuccess(res, 'recurring invoice schedules listed', items)
})

export const getRecurringSchedule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getRecurringSchedule(tenantId, id)
  return sendSuccess(res, 'recurring invoice schedule fetched', item)
})

export const cancelRecurringSchedule = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelRecurringSchedule(req, tenantId, id, req.body as CancelRecurringScheduleInput)
  return sendSuccess(res, 'recurring invoice schedule cancelled', item)
})

export const listUpcomingInvoices = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListUpcomingInvoicesQueryInput
  const items = await service.listUpcomingInvoices(tenantId, query)
  return sendSuccess(res, 'upcoming invoices listed', items)
})

export const approveUpcomingInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const executionId = getRouteParam(req, 'executionId')
  const invoice = await generationService.approveUpcomingInvoice(req, tenantId, id, executionId)
  return sendSuccess(res, 'upcoming invoice approved — sales invoice draft created', invoice)
})
