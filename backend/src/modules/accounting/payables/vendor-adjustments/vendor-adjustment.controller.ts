import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListVendorAdjustmentsQuery } from './vendor-adjustment.schemas.js'
import * as draft from './vendor-adjustment-draft.service.js'
import * as read from './vendor-adjustment-read.service.js'
import * as workflow from './vendor-adjustment-workflow.service.js'
import * as approval from './vendor-adjustment-approval.service.js'

export const listVendorAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listVendorAdjustments(req, getTenantId(req), req.query as unknown as ListVendorAdjustmentsQuery)
  return sendPaginated(res, 'vendor invoices listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'vendor invoice draft created', await draft.createVendorAdjustmentDraft(req, getTenantId(req), req.body)))

export const getVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice fetched', await read.getVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice updated', await draft.updateVendorAdjustmentDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice validated', await draft.validateVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice submitted', await workflow.submitVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markVendorAdjustmentReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice marked ready to post', await workflow.markVendorAdjustmentReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice revised to draft', await workflow.reviseVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice cancelled', await workflow.cancelVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice approved', await approval.approveVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectVendorAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice rejected', await approval.rejectVendorAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getVendorAdjustmentApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'vendor invoice approval fetched', await approval.getVendorAdjustmentApproval(req, getTenantId(req), getRouteParam(req, 'id'))))
