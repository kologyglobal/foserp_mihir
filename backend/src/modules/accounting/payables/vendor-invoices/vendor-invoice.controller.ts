import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListVendorInvoicesQuery } from './vendor-invoice.schemas.js'
import * as draft from './vendor-invoice-draft.service.js'
import * as read from './vendor-invoice-read.service.js'
import * as workflow from './vendor-invoice-workflow.service.js'
import * as approval from './vendor-invoice-approval.service.js'

export const listVendorInvoices = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listVendorInvoices(req, getTenantId(req), req.query as unknown as ListVendorInvoicesQuery)
  return sendPaginated(res, 'vendor invoices listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'vendor invoice draft created', await draft.createVendorInvoiceDraft(req, getTenantId(req), req.body)))

export const getVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice fetched', await read.getVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice updated', await draft.updateVendorInvoiceDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice validated', await draft.validateVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice submitted', await workflow.submitVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markVendorInvoiceReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice marked ready to post', await workflow.markVendorInvoiceReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice revised to draft', await workflow.reviseVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice cancelled', await workflow.cancelVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice approved', await approval.approveVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectVendorInvoice = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice rejected', await approval.rejectVendorInvoice(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getVendorInvoiceApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice approval fetched', await approval.getVendorInvoiceApproval(req, getTenantId(req), getRouteParam(req, 'id'))))
