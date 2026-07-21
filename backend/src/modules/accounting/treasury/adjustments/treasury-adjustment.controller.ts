import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import type { ListTreasuryAdjustmentsQuery } from './treasury-adjustment.schemas.js'
import * as draft from './treasury-adjustment-draft.service.js'
import * as read from './treasury-adjustment-read.service.js'
import * as workflow from './treasury-adjustment-workflow.service.js'
import { postTreasuryAdjustmentWithStatementMatch } from './posting/treasury-adjustment-statement-posting.service.js'
import { reverseTreasuryAdjustment } from './posting/treasury-adjustment-reverse.service.js'
import { createTreasuryAdjustmentFromStatementLine } from './treasury-adjustment-statement.service.js'

export const listTreasuryAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const result = await read.listTreasuryAdjustments(req, getTenantId(req), req.query as unknown as ListTreasuryAdjustmentsQuery)
  return sendPaginated(res, 'treasury adjustments listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'treasury adjustment draft created', await draft.createTreasuryAdjustmentDraft(req, getTenantId(req), req.body)))

export const getTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment fetched', await read.getTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment updated', await draft.updateTreasuryAdjustmentDraft(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const validateTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment validated', await draft.validateTreasuryAdjustmentById(req, getTenantId(req), getRouteParam(req, 'id'))))

export const submitTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment submitted', await workflow.submitTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const markTreasuryAdjustmentReady = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment marked ready', await workflow.markTreasuryAdjustmentReady(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reviseTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment revised to draft', await workflow.reviseTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment cancelled', await workflow.cancelTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const approveTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment approved', await workflow.approveTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const rejectTreasuryAdjustment = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment rejected', await workflow.rejectTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const getTreasuryAdjustmentApproval = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment approval fetched', await workflow.getTreasuryAdjustmentApproval(req, getTenantId(req), getRouteParam(req, 'id'))))

export const postTreasuryAdjustmentHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment posted', await postTreasuryAdjustmentWithStatementMatch(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const reverseTreasuryAdjustmentHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'treasury adjustment reversed', await reverseTreasuryAdjustment(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const createTreasuryAdjustmentFromStatementLineHandler = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'treasury adjustment draft created from statement line',
    await createTreasuryAdjustmentFromStatementLine(req, getTenantId(req), getRouteParam(req, 'statementId'), getRouteParam(req, 'lineId'), req.body),
  ))
