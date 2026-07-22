import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../../types/request-context.js'
import { asyncHandler } from '../../../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../../../utils/response.js'
import * as service from './bank-statement-import.service.js'

export const createImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const file = req.file
  if (!file) {
    return res.status(400).json({ success: false, message: 'File is required', code: 'BANK_STATEMENT_FILE_REQUIRED' })
  }
  const item = await service.uploadImportBatch(req, tenantId, req.body, file)
  return sendCreated(res, 'import batch uploaded', item)
})

export const getImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getImportBatch(tenantId, id)
  return sendSuccess(res, 'import batch fetched', item)
})

export const inspectImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.inspectBatch(req, tenantId, id, req.body)
  return sendSuccess(res, 'import batch inspected', item)
})

export const previewImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.previewBatch(req, tenantId, id, req.body)
  return sendSuccess(res, 'import batch preview generated', item)
})

export const importImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.executeImport(req, tenantId, id, req.body)
  return sendSuccess(res, 'import batch processed', item)
})

export const retryImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.retryImport(req, tenantId, id, req.body)
  return sendSuccess(res, 'import batch retried', item)
})

export const cancelImportBatch = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelImportBatch(req, tenantId, id, req.body)
  return sendSuccess(res, 'import batch cancelled', item)
})

export const downloadImportBatchFile = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const file = await service.downloadBatchFile(tenantId, id)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`)
  return res.send(file.buffer)
})
