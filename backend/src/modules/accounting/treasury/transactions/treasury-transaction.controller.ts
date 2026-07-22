import type { Request, Response } from 'express'
import { getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendPaginated } from '../../../../utils/response.js'
import type { ListTreasuryTransactionsQuery } from './treasury-transaction.schemas.js'
import * as service from './treasury-transaction.service.js'

export const listTreasuryTransactions = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listTreasuryTransactions(
    getTenantId(req),
    req.query as unknown as ListTreasuryTransactionsQuery,
  )
  return sendPaginated(
    res,
    'treasury transactions listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})
