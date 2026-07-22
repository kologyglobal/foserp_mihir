import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListVendorPaymentsQuery } from './vendor-payment.schemas.js'
import * as draft from './vendor-payment-draft.service.js'
import * as read from './vendor-payment-read.service.js'
import * as workflow from './vendor-payment-workflow.service.js'
import * as approval from './vendor-payment-approval.service.js'

export const listVendorPayments = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listVendorPayments(req, getTenantId(req), req.query as unknown as ListVendorPaymentsQuery)
  return sendPaginated(res, 'vendor payments listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'vendor payment draft created', await draft.createVendorPaymentDraft(req, getTenantId(req), req.body)))

export const getVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment fetched', await read.getVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment updated', await draft.updateVendorPaymentDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment validated', await draft.validateVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment submitted', await workflow.submitVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markVendorPaymentReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment marked ready to post', await workflow.markVendorPaymentReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment revised to draft', await workflow.reviseVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment cancelled', await workflow.cancelVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment approved', await approval.approveVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectVendorPayment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment rejected', await approval.rejectVendorPayment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getVendorPaymentApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor payment approval fetched', await approval.getVendorPaymentApproval(req, getTenantId(req), getRouteParam(req, 'id'))))
