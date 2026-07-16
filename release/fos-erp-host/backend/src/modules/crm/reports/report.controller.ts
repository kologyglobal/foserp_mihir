import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated } from '../../../utils/response.js'
import * as service from './report.service.js'
import type { ReportQuery } from './report.validation.js'

export const getReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ReportQuery
  const result = await service.getReport(tenantId, query)
  sendPaginated(
    res,
    'CRM report retrieved',
    result.rows as Record<string, unknown>[],
    buildPaginationMeta(result.total, query.page, query.limit),
  )
})
