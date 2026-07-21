import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './quotation.service.js'

export const listQuotations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listQuotations(tenantId, req.query as never)
  sendPaginated(res, 'Quotations retrieved', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getQuotation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getQuotation(tenantId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Quotation retrieved', data)
})

export const createQuotation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createQuotation(tenantId, userId, req.body)
  sendCreated(res, 'Quotation created', data)
})

export const updateQuotation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateQuotation(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendSuccess(res, 'Quotation updated', data)
})

export const deleteQuotation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  await service.deleteQuotation(tenantId, getRouteParam(req, 'id'), userId)
  sendSuccess(res, 'Quotation deleted', null)
})

export const updateQuotationDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.updateQuotationDocument(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Quotation document updated', data)
})

export const createQuotationRevision = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.createQuotationRevision(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendCreated(res, 'Quotation revision created', data)
})

export const submitDocumentForApproval = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.submitDocumentForApproval(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Quotation submitted for approval', data)
})

export const approveDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.approveDocument(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Quotation approved', data)
})

export const rejectDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.rejectDocument(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    req.body,
  )
  sendSuccess(res, 'Quotation rejected', data)
})

export const markDocumentSent = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.markDocumentSent(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
  )
  sendSuccess(res, 'Quotation marked as sent', data)
})

export const customerApproveDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.recordCustomerApproval(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    { ...req.body, decision: 'approved' },
  )
  sendSuccess(res, 'Customer approved quotation', data)
})

export const customerRejectDocument = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.recordCustomerApproval(
    tenantId,
    getRouteParam(req, 'id'),
    getRouteParam(req, 'docId'),
    userId,
    { ...req.body, decision: 'rejected' },
  )
  sendSuccess(res, 'Customer rejected quotation', data)
})

export const convertQuotationToSalesOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.convertQuotationToSalesOrder(tenantId, getRouteParam(req, 'id'), userId, req.body)
  sendCreated(res, 'Sales order created from quotation', data)
})
