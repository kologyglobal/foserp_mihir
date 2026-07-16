import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './search.service.js'
import type { SearchQuery } from './search.validation.js'

export const search = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as SearchQuery
  const data = await service.searchCrm(tenantId, query)
  sendSuccess(res, 'CRM search results', data)
})
