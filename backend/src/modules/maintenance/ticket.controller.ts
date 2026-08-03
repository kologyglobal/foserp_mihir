import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as service from './ticket.service.js'
import type {
  AddPartInput,
  CloseTicketInput,
  CreateTicketInput,
  HoldTicketInput,
  ListTicketsQuery,
  ReportQuery,
  ResumeTicketInput,
  StartRepairInput,
  TestMachineInput,
  UpdateRepairInput,
} from './ticket.schemas.js'

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listTickets(tenantId, req.query as unknown as ListTicketsQuery)
  return sendPaginated(
    res,
    'Maintenance tickets listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.getTicket(tenantId, getRouteParam(req, 'id'))
  return sendSuccess(res, 'Maintenance ticket fetched', item)
})

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createTicket(req, tenantId, req.body as CreateTicketInput)
  return sendCreated(res, 'Maintenance ticket created', item)
})

export const startRepair = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.startRepair(req, tenantId, getRouteParam(req, 'id'), req.body as StartRepairInput)
  return sendSuccess(res, 'Repair started', item)
})

export const updateRepair = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.updateRepair(req, tenantId, getRouteParam(req, 'id'), req.body as UpdateRepairInput)
  return sendSuccess(res, 'Ticket updated', item)
})

export const holdTicket = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.holdTicket(req, tenantId, getRouteParam(req, 'id'), req.body as HoldTicketInput)
  return sendSuccess(res, 'Ticket put on hold', item)
})

export const resumeTicket = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.resumeTicket(req, tenantId, getRouteParam(req, 'id'), req.body as ResumeTicketInput)
  return sendSuccess(res, 'Ticket resumed', item)
})

export const addPart = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.addPart(req, tenantId, getRouteParam(req, 'id'), req.body as AddPartInput)
  return sendSuccess(res, 'Part added', item)
})

export const testMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.testMachine(req, tenantId, getRouteParam(req, 'id'), req.body as TestMachineInput)
  return sendSuccess(res, 'Machine tested', item)
})

export const closeReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const ticket = await service.getTicket(tenantId, getRouteParam(req, 'id'))
  return sendSuccess(res, 'Close readiness', service.closeReadiness(ticket))
})

export const closeTicket = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.closeTicket(req, tenantId, getRouteParam(req, 'id'), req.body as CloseTicketInput)
  return sendSuccess(res, 'Ticket closed', item)
})

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getDashboard(tenantId)
  return sendSuccess(res, 'Maintenance dashboard', data)
})

export const machineHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getMachineHistory(tenantId, getRouteParam(req, 'machineId'))
  return sendSuccess(res, 'Machine maintenance history', data)
})

export const reports = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getReports(tenantId, req.query as unknown as ReportQuery)
  return sendSuccess(res, 'Maintenance reports', data)
})

export const activeTicketForMachine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const machineId = String(req.query.machineId ?? '')
  const item = await service.getActiveTicketForMachine(tenantId, machineId)
  return sendSuccess(res, 'Active maintenance ticket for machine', item)
})

export const linkPartPr = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.linkPartToPurchaseRequisition(
    req,
    tenantId,
    getRouteParam(req, 'id'),
    req.body as { partId: string; purchaseRequisitionId: string },
  )
  return sendSuccess(res, 'Part linked to purchase requisition', item)
})

export const machineHealth = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { listMachineHealth } = await import('./machine-health.service.js')
  const data = await listMachineHealth(tenantId, req.query as never)
  return sendSuccess(res, 'Machine health', data)
})

export const machineHealthDetail = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { getMachineHealthDetail } = await import('./machine-health.service.js')
  const data = await getMachineHealthDetail(tenantId, getRouteParam(req, 'machineId'), req.query as never)
  if (!data) {
    const { NotFoundError } = await import('../../utils/errors.js')
    throw new NotFoundError('Machine not found')
  }
  return sendSuccess(res, 'Machine health detail', data)
})
