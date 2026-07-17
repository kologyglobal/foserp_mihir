import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { AppError } from '../../../utils/errors.js'
import * as service from './finance-settings.service.js'

export const getFinanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.getRecord(req, tenantId, req.query as never)
  return sendSuccess(res, 'finance settings fetched', item)
})

export const upsertFinanceSettings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.upsertRecord(req, tenantId, req.body)
  return sendSuccess(res, 'finance settings saved', item)
})

export const getSetupStatus = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId = typeof req.query.legalEntityId === 'string' ? req.query.legalEntityId : undefined
  const item = await service.getSetupStatus(req, tenantId, legalEntityId)
  return sendSuccess(res, 'finance setup status fetched', item)
})

export const activateFinance = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  try {
    const item = await service.activateRecord(req, tenantId, req.body)
    return sendSuccess(res, 'finance activated', item)
  } catch (err) {
    if (err instanceof AppError && err.code === 'SETUP_INCOMPLETE') {
      const legalEntityId = req.body?.legalEntityId as string
      const status = await service.getSetupStatus(req, tenantId, legalEntityId)
      return res.status(422).json({
        success: false,
        message: 'Finance setup is incomplete.',
        data: status,
      })
    }
    throw err
  }
})
