import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListTreasuryTransfersQuery } from './treasury-transfer.schemas.js'
import * as draft from './treasury-transfer-draft.service.js'
import * as read from './treasury-transfer-read.service.js'
import * as workflow from './treasury-transfer-workflow.service.js'

export const listTreasuryTransfers = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listTreasuryTransfers(req, getTenantId(req), req.query as unknown as ListTreasuryTransfersQuery)
  return sendPaginated(res, 'treasury transfers listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const listInTransitTreasuryTransfers = asyncHandler(async (req: Request, res: Response) => {
  const query = { ...(req.query as unknown as ListTreasuryTransfersQuery), status: 'IN_TRANSIT' as const }
  const result = await read.listTreasuryTransfers(req, getTenantId(req), query)
  return sendPaginated(res, 'in-transit treasury transfers listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'treasury transfer draft created', await draft.createTreasuryTransferDraft(req, getTenantId(req), req.body)))

export const getTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer fetched', await read.getTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer updated', await draft.updateTreasuryTransferDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer validated', await draft.validateTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer submitted', await workflow.submitTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markTreasuryTransferReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer marked ready to post', await workflow.markTreasuryTransferReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer revised to draft', await workflow.reviseTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer cancelled', await workflow.cancelTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer approved', await workflow.approveTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectTreasuryTransfer = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer rejected', await workflow.rejectTreasuryTransfer(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getTreasuryTransferApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury transfer approval fetched', await workflow.getTreasuryTransferApproval(req, getTenantId(req), getRouteParam(req, 'id'))))
