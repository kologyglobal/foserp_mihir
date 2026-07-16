import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import * as service from './export.service.js'
import type { CrmExportQuery } from './export.validation.js'

export const exportResource = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const resource = req.params.resource as string
  const csv = await service.exportCsv(tenantId, resource, req.query as unknown as CrmExportQuery)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="crm-${resource}.csv"`)
  res.send(csv)
})
