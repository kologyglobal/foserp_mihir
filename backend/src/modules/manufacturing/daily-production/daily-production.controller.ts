import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dateOnly, dec, isoDate } from '../shared/manufacturing.mappers.js'
import * as service from './daily-production.service.js'
import type {
  CorrectDailyLineInput,
  CreateDailyBatchInput,
  ListDailyBatchesQuery,
  UpdateDailyBatchInput,
  UpsertDailyLineInput,
} from './daily-production.schemas.js'

function mapLine(row: Record<string, unknown>) {
  return {
    ...row,
    goodQuantity: dec(row.goodQuantity as never),
    reworkQuantity: dec(row.reworkQuantity as never),
    rejectedQuantity: dec(row.rejectedQuantity as never),
    scrapQuantity: dec(row.scrapQuantity as never),
  }
}

function mapBatch(row: Record<string, unknown>) {
  const lines = (row.lines as Record<string, unknown>[] | undefined) ?? []
  return {
    ...row,
    productionDate: dateOnly(row.productionDate as Date),
    submittedAt: isoDate(row.submittedAt as Date | null),
    lines: lines.map(mapLine),
  }
}

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createBatch(req, tenantId, req.body as CreateDailyBatchInput)
  return sendCreated(res, 'Daily production batch created', mapBatch(item as never))
})

export const listBatches = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listBatches(tenantId, req.query as unknown as ListDailyBatchesQuery)
  return sendPaginated(
    res,
    'Daily production batches listed',
    result.items.map((item) => mapBatch(item as never)),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getBatch(tenantId, id)
  return sendSuccess(res, 'Daily production batch fetched', mapBatch(item as never))
})

export const updateBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.updateBatchHeader(req, tenantId, id, req.body as UpdateDailyBatchInput)
  return sendSuccess(res, 'Daily production batch updated', mapBatch(item as never))
})

export const addLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const batchId = getRouteParam(req, 'id')
  const item = await service.addLine(req, tenantId, batchId, req.body as UpsertDailyLineInput)
  return sendCreated(res, 'Daily production line added', mapLine(item as never))
})

export const updateLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const batchId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const item = await service.updateLine(req, tenantId, batchId, lineId, req.body as UpsertDailyLineInput)
  return sendSuccess(res, 'Daily production line updated', mapLine(item as never))
})

export const removeLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const batchId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  await service.removeLine(req, tenantId, batchId, lineId)
  return sendSuccess(res, 'Daily production line removed', null)
})

export const validateBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.validateBatch(tenantId, id)
  return sendSuccess(res, 'Daily production batch validated', result)
})

export const submitBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.submitBatch(req, tenantId, id)
  return sendSuccess(res, 'Daily production batch submitted', {
    batch: mapBatch(result.batch as never),
    ledgerEntryIds: result.ledgerIds,
  })
})

export const correctLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const batchId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const result = await service.correctLine(req, tenantId, batchId, lineId, req.body as CorrectDailyLineInput)
  return sendSuccess(res, 'Daily production line corrected', {
    reversalId: result.reversal.id,
    correctionId: result.correction.id,
  })
})
