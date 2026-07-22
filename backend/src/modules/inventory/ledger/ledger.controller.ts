import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated } from '../../../utils/response.js'
import * as service from './ledger.service.js'
import type { ListLedgerQuery } from './ledger.schemas.js'

export const listLedger = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listLedger(tenantId, req.query as unknown as ListLedgerQuery)
  return sendPaginated(res, 'Stock ledger listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})
