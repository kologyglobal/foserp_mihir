import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import * as lineService from './bank-statement-line.service.js'
import * as service from './bank-statement.service.js'

export const listBankStatements = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listStatements(tenantId, req.query as never)
  return sendPaginated(res, 'bank statements listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getBankStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getStatement(tenantId, id)
  return sendSuccess(res, 'bank statement fetched', item)
})

export const createManualBankStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createManualStatement(req, tenantId, req.body)
  return sendCreated(res, 'bank statement created', item)
})

export const updateBankStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateStatement(req, tenantId, id, req.body)
  return sendSuccess(res, 'bank statement updated', item)
})

export const validateBankStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.validateStatement(req, tenantId, id, req.body)
  return sendSuccess(res, 'bank statement validated', item)
})

export const reopenBankStatementDraft = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.reopenDraft(req, tenantId, id, req.body)
  return sendSuccess(res, 'bank statement reopened to draft', item)
})

export const cancelBankStatement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelStatement(req, tenantId, id, req.body)
  return sendSuccess(res, 'bank statement cancelled', item)
})

export const addBankStatementLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await lineService.addLine(req, tenantId, id, req.body)
  return sendCreated(res, 'bank statement line added', item)
})

export const updateBankStatementLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const item = await lineService.updateLine(req, tenantId, statementId, lineId, req.body)
  return sendSuccess(res, 'bank statement line updated', item)
})

export const deleteBankStatementLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const statementId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const item = await lineService.removeLine(req, tenantId, statementId, lineId, req.body.expectedUpdatedAt)
  return sendSuccess(res, 'bank statement line deleted', item)
})
