import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import * as service from './export.service.js'
import type { MasterExportQuery } from './export.validation.js'

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
}

export const exportItems = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const csv = await service.exportItemsCsv(tenantId, req.query as MasterExportQuery)
  sendCsv(res, 'items-export.csv', csv)
})

export const exportVendors = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const csv = await service.exportVendorsCsv(tenantId, req.query as MasterExportQuery)
  sendCsv(res, 'vendors-export.csv', csv)
})

export const exportHsnSac = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const csv = await service.exportHsnSacCsv(tenantId, req.query as MasterExportQuery)
  sendCsv(res, 'hsn-sac-export.csv', csv)
})
