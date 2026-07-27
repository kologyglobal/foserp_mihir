import type { Request, Response } from 'express'
import { getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendPaginated } from '../../../../utils/response.js'
import { listApReversalHistory } from './ap-reversal-history.service.js'

export const listReversalHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId =
    typeof req.query.legalEntityId === 'string' && req.query.legalEntityId.trim()
      ? req.query.legalEntityId.trim()
      : undefined
  const page = req.query.page != null ? Number(req.query.page) : undefined
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined

  const result = await listApReversalHistory(tenantId, { legalEntityId, page, limit })
  return sendPaginated(res, 'AP reversal history', result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / Math.max(result.limit, 1))),
  })
})
