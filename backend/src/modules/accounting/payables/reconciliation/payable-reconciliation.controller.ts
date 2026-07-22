import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import { exportReconciliationRunCsv } from './payable-reconciliation-export.service.js'
import {
  acknowledgeReconciliationException,
  getReconciliationExceptionDetail,
  getReconciliationRunDetail,
  listReconciliationAccountResults,
  listReconciliationExceptions,
  listReconciliationRunVendors,
  listReconciliationRuns,
} from './payable-reconciliation-read.service.js'
import { createReconciliationRun } from './payable-reconciliation.service.js'
import type {
  AcknowledgeExceptionBodyInput,
  CreateReconciliationRunBodyInput,
  ListReconciliationAccountsQueryInput,
  ListReconciliationExceptionsQueryInput,
  ListReconciliationRunsQueryInput,
} from './payable-reconciliation.schemas.js'

export const createReconciliationRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const body = req.body as CreateReconciliationRunBodyInput
  const result = await createReconciliationRun(
    tenantId,
    { tenantId, userId: req.context?.userId ?? null },
    body,
  )
  return sendCreated(res, 'AP reconciliation run created', result)
})

export const listReconciliationRunsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListReconciliationRunsQueryInput
  const result = await listReconciliationRuns(tenantId, query)
  return sendPaginated(res, 'AP reconciliation runs listed', result.items, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getReconciliationRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const result = await getReconciliationRunDetail(tenantId, runId)
  return sendSuccess(res, 'AP reconciliation run fetched', result)
})

export const listReconciliationRunAccountsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListReconciliationAccountsQueryInput
  const result = await listReconciliationAccountResults(tenantId, runId, query.page, query.pageSize)
  return sendPaginated(res, 'AP reconciliation account results listed', result.items, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const listReconciliationRunVendorsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListReconciliationAccountsQueryInput
  const result = await listReconciliationRunVendors(tenantId, runId, query.page, query.pageSize)
  return sendPaginated(res, 'AP reconciliation vendor results listed', result.items, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const listReconciliationRunExceptionsHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const query = req.query as unknown as ListReconciliationExceptionsQueryInput
  const result = await listReconciliationExceptions(tenantId, runId, query)
  return sendPaginated(res, 'AP reconciliation exceptions listed', result.items, buildPaginationMeta(result.total, result.page, result.pageSize))
})

export const getReconciliationExceptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const exceptionId = getRouteParam(req, 'id')
  const result = await getReconciliationExceptionDetail(tenantId, exceptionId)
  return sendSuccess(res, 'AP reconciliation exception fetched', result)
})

export const acknowledgeReconciliationExceptionHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const exceptionId = getRouteParam(req, 'id')
  const body = req.body as AcknowledgeExceptionBodyInput
  const result = await acknowledgeReconciliationException(tenantId, exceptionId, req.context?.userId ?? null, body)
  return sendSuccess(res, 'AP reconciliation exception acknowledged', result)
})

export const exportReconciliationRunHandler = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const runId = getRouteParam(req, 'id')
  const csv = await exportReconciliationRunCsv(tenantId, runId)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="ap-reconciliation-${runId}.csv"`)
  res.send(csv)
})
