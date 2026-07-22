import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../utils/response.js'
import * as service from './bank-reconciliation-profile.service.js'

export const getBankReconciliationProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const treasuryAccountId = getRouteParam(req, 'id')
  const item = await service.getRecord(tenantId, treasuryAccountId)
  return sendSuccess(res, 'bank reconciliation profile fetched', item)
})

export const putBankReconciliationProfile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const treasuryAccountId = getRouteParam(req, 'id')
  const item = await service.upsertRecord(req, tenantId, treasuryAccountId, req.body)
  return sendSuccess(res, 'bank reconciliation profile saved', item)
})
