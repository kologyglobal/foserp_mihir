import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import * as service from './default-mapping.service.js'

export const listDefaultMappings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.listRecords(req, tenantId, req.query as never)
  return sendSuccess(res, 'default mappings listed', items)
})

export const upsertDefaultMappings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const items = await service.upsertRecords(req, tenantId, req.body)
  return sendSuccess(res, 'default mappings saved', items)
})

export const validateDefaultMappings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const legalEntityId = typeof req.query.legalEntityId === 'string' ? req.query.legalEntityId : undefined
  const result = await service.validateRecords(req, tenantId, legalEntityId)
  return sendSuccess(res, 'default mappings validated', result)
})
