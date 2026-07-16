import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './lead.service.js'
import * as bulkService from './lead-bulk.service.js'

export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listLeads(tenantId, req.query as never)
  sendPaginated(res, 'Leads retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getLead(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Lead retrieved', data)
})

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createLead(tenantId, userId, req.body)
  sendCreated(res, 'Lead created', data)
})

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateLead(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead updated', data)
})

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteLead(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Lead deleted', null)
})

export const assignLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.assignLead(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead assigned', data)
})

export const qualifyLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.qualifyLead(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead qualified', data)
})

export const changeLeadStage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.changeLeadStage(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead stage updated', data)
})

export const disqualifyLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.disqualifyLead(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead disqualified', data)
})

export const convertLead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.convertLead(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Lead converted', data)
})

export const bulkAssignLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await bulkService.bulkAssignLeads(tenantId, userId, req.body)
  sendSuccess(res, 'Bulk assign completed', data)
})

export const bulkStatusLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await bulkService.bulkStatusLeads(tenantId, userId, req.body)
  sendSuccess(res, 'Bulk status update completed', data)
})

export const bulkArchiveLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await bulkService.bulkArchiveLeads(tenantId, userId, req.body.leadIds)
  sendSuccess(res, 'Bulk archive completed', data)
})

export const bulkRestoreLeads = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await bulkService.bulkRestoreLeads(tenantId, userId, req.body.leadIds)
  sendSuccess(res, 'Bulk restore completed', data)
})

export const getLeadStatusHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getLeadStatusHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Lead status history retrieved', data)
})

export const getLeadAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getLeadAssignmentHistory(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Lead assignment history retrieved', data)
})
