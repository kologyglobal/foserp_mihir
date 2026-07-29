import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { NotFoundError } from '../../../utils/errors.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './costing.service.js'
import type {
  ListCostEntriesQuery,
  ListCostLayersQuery,
  ListVariancesQuery,
  MethodChangeBody,
  UpsertStandardCostBody,
  ValuationReconciliationQuery,
} from './costing.schemas.js'

export const listCostEntries = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listCostEntries(getTenantId(req), req.query as unknown as ListCostEntriesQuery)
  return sendPaginated(
    res,
    'Inventory cost entries listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getCostEntry = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCostEntry(getTenantId(req), String(req.params.id))
  if (!data) throw new NotFoundError('Cost entry not found')
  return sendSuccess(res, 'Inventory cost entry retrieved', data)
})

export const listCostLayers = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listCostLayers(getTenantId(req), req.query as unknown as ListCostLayersQuery)
  return sendPaginated(
    res,
    'Inventory cost layers listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getCostLayer = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCostLayer(getTenantId(req), String(req.params.id))
  if (!data) throw new NotFoundError('Cost layer not found')
  return sendSuccess(res, 'Inventory cost layer retrieved', data)
})

export const getValuationReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.reconcileValuation(
    getTenantId(req),
    req.query as unknown as ValuationReconciliationQuery,
  )
  return sendSuccess(res, 'Inventory valuation reconciliation', data)
})

export const listCostVariances = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listCostVariances(getTenantId(req), req.query as unknown as ListVariancesQuery)
  return sendPaginated(
    res,
    'Inventory cost variances listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const postStandardCostVersion = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.upsertStandardCostVersion(
    getTenantId(req),
    getContext(req).userId,
    req.body as UpsertStandardCostBody,
  )
  return sendSuccess(res, 'Standard cost version saved', data, 201)
})

export const postMethodChange = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.changeValuationMethod(
    getTenantId(req),
    getContext(req).userId,
    req.body as MethodChangeBody,
  )
  return sendSuccess(res, 'Valuation method change applied', data)
})

export const getItemCostingSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getItemCostingSummary(getTenantId(req), String(req.params.itemId))
  if (!data) throw new NotFoundError('Item not found')
  return sendSuccess(res, 'Item costing summary', data)
})

export const getEffectiveMethod = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getEffectiveMethod(getTenantId(req), req.query as {
    itemId?: string
    legalEntityId?: string
    warehouseId?: string
    postingDate?: Date
  })
  return sendSuccess(res, 'Effective inventory valuation method', data)
})

export const getCostingOverview = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCostingOverview(getTenantId(req))
  return sendSuccess(res, 'Inventory costing overview', data)
})

export const listValuationItems = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listValuationItems(getTenantId(req), req.query as {
    page?: number
    limit?: number
    warehouseId?: string
    itemId?: string
    search?: string
  })
  return sendPaginated(
    res,
    'Valuation items listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listMovingAverage = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listMovingAverageState(getTenantId(req), req.query as {
    page?: number
    limit?: number
    warehouseId?: string
    itemId?: string
  })
  return sendPaginated(
    res,
    'Moving average state listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listMovingAverageHistory = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listMovingAverageHistory(
    getTenantId(req),
    req.query as unknown as { itemId: string; warehouseId?: string; limit?: number },
  )
  return sendSuccess(res, 'Moving average history (derived)', data)
})

export const previewMethodChange = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.previewValuationMethodChange(
    getTenantId(req),
    req.query as unknown as {
      toMethod: 'standard' | 'average' | 'fifo' | 'specific'
      effectiveDate?: Date
    },
  )
  return sendSuccess(res, 'Valuation method change preview', data)
})

export const listStandardCosts = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listStandardCostVersions(getTenantId(req), req.query as {
    page?: number
    limit?: number
    itemId?: string
    status?: string
  })
  return sendPaginated(
    res,
    'Standard cost versions listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const listSpecificIdentification = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listSpecificIdentification(getTenantId(req), req.query as {
    page?: number
    limit?: number
    itemId?: string
    unidentifiedOnly?: boolean
  })
  return sendPaginated(
    res,
    'Specific identification layers listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const runValuationReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.runValuationReconciliation(
    getTenantId(req),
    (req.body ?? {}) as ValuationReconciliationQuery,
  )
  return sendSuccess(res, 'Valuation reconciliation refreshed', data)
})
