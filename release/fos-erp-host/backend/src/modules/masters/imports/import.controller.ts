import type { Request, Response } from 'express'
import { getContext, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../utils/response.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import * as service from './import.service.js'
import type { ImportSummary } from './import.validation.js'

async function auditImport(
  req: Request,
  tenantId: string,
  entity: string,
  summary: ImportSummary,
): Promise<void> {
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'master',
    entity,
    action: 'IMPORT',
    newValues: summary,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export const getItemImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.itemImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="item-import-template.csv"')
  res.send(csv)
})

export const getVendorImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.vendorImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="vendor-import-template.csv"')
  res.send(csv)
})

export const getHsnSacImportTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const csv = service.hsnSacImportTemplateCsv()
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="hsn-sac-import-template.csv"')
  res.send(csv)
})

export const importItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importItems(req, tenantId, userId, req.body)
  await auditImport(req, tenantId, 'masterItem', result)
  sendSuccess(res, 'Item import completed', result)
})

export const importVendors = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importVendors(req, tenantId, userId, req.body)
  await auditImport(req, tenantId, 'masterVendor', result)
  sendSuccess(res, 'Vendor import completed', result)
})

export const importHsnSac = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const result = await service.importHsnSac(req, tenantId, userId, req.body)
  await auditImport(req, tenantId, 'masterHsnCode', result)
  sendSuccess(res, 'HSN/SAC import completed', result)
})
