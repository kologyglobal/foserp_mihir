import type { Request, Response } from 'express'
import { auditFromRequest } from '../../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './commercial.service.js'

export const syncBundle = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined
  const data = await service.syncBundle(tenantId, companyId)
  sendSuccess(res, 'Commercial bundle retrieved', data)
})

export const listProformas = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listProformas(getTenantId(req), req.query as never)
  sendPaginated(res, 'Proforma invoices retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getProforma = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getProforma(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Proforma invoice retrieved', data)
})

export const createProforma = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createProforma(tenantId, userId, req.body, auditFromRequest(req))
  sendCreated(res, 'Proforma invoice created', data)
})

export const updateProforma = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateProforma(tenantId, getRouteParam(req, 'id'), userId, req.body, auditFromRequest(req))
  sendSuccess(res, 'Proforma invoice updated', data)
})

export const issueProforma = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.issueProforma(tenantId, getRouteParam(req, 'id'), userId, auditFromRequest(req))
  sendSuccess(res, 'Proforma invoice issued', data)
})

export const cancelProforma = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.cancelProforma(tenantId, getRouteParam(req, 'id'), userId, auditFromRequest(req))
  sendSuccess(res, 'Proforma invoice cancelled', data)
})

export const listReceipts = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listReceipts(getTenantId(req), req.query as never)
  sendPaginated(res, 'Receipts retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getReceipt = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getReceipt(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Receipt retrieved', data)
})

export const createReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createReceipt(tenantId, userId, req.body, auditFromRequest(req))
  sendCreated(res, 'Receipt created', data)
})

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listInvoices(getTenantId(req), req.query as never)
  sendPaginated(res, 'Invoices retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getInvoice(getTenantId(req), getRouteParam(req, 'id'))
  sendSuccess(res, 'Invoice retrieved', data)
})

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createInvoice(tenantId, userId, req.body, auditFromRequest(req))
  sendCreated(res, 'Invoice created', data)
})

export const postInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.postInvoice(tenantId, getRouteParam(req, 'id'), userId, auditFromRequest(req))
  sendSuccess(res, 'Invoice posted', data)
})

export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.cancelDraftInvoice(tenantId, getRouteParam(req, 'id'), userId, auditFromRequest(req))
  sendSuccess(res, 'Invoice cancelled', data)
})

export const listAllocations = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listAllocations(getTenantId(req), req.query as never)
  sendPaginated(res, 'Allocations retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const allocatePayments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.allocatePayments(tenantId, userId, req.body, auditFromRequest(req))
  sendCreated(res, 'Payments allocated', data)
})

export const reverseAllocation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.reverseAllocation(tenantId, getRouteParam(req, 'id'), userId, auditFromRequest(req))
  sendSuccess(res, 'Allocation reversed', data)
})
