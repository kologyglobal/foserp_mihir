import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './balance.service.js'
import { reconcileInventoryBalances } from './reconciliation.service.js'
import type {
  ListBalancesQuery,
  ReconcileBalancesQuery,
  StockPositionQuery,
} from './balance.schemas.js'

export const listBalances = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listBalances(tenantId, req.query as unknown as ListBalancesQuery)
  return sendPaginated(res, 'Stock balances listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getStockPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { itemId, warehouseId } = req.query as unknown as StockPositionQuery
  const position = await service.getStockPosition(tenantId, itemId, warehouseId)
  return sendSuccess(res, 'Stock position fetched', position)
})

export const reconcileBalances = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await reconcileInventoryBalances(
    tenantId,
    req.query as unknown as ReconcileBalancesQuery,
  )
  return sendSuccess(res, 'Inventory balance reconciliation completed', result)
})
