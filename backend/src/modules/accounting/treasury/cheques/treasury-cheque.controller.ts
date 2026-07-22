import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListTreasuryChequesQuery } from './treasury-cheque.schemas.js'
import * as draft from './treasury-cheque-draft.service.js'
import * as read from './treasury-cheque-read.service.js'
import * as workflow from './treasury-cheque-workflow.service.js'

export const listTreasuryCheques = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listTreasuryCheques(req, getTenantId(req), req.query as unknown as ListTreasuryChequesQuery)
  return sendPaginated(res, 'treasury cheques listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'treasury cheque draft created', await draft.createTreasuryChequeDraft(req, getTenantId(req), req.body)))

export const getTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque fetched', await read.getTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque updated', await draft.updateTreasuryChequeDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque validated', await draft.validateTreasuryChequeById(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque submitted', await workflow.submitTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markTreasuryChequeReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque marked ready', await workflow.markTreasuryChequeReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque revised to draft', await workflow.reviseTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque cancelled', await workflow.cancelTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque approved', await workflow.approveTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectTreasuryCheque = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque rejected', await workflow.rejectTreasuryCheque(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getTreasuryChequeApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury cheque approval fetched', await workflow.getTreasuryChequeApproval(req, getTenantId(req), getRouteParam(req, 'id'))))
