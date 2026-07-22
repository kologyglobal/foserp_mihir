import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { listReportCatalog } from './catalog.service.js'
import { exportReportCsv } from './export.service.js'
import type { ReportQueryBodyInput } from './schemas.js'
import { executeReport } from './query.service.js'

export const getCatalog = asyncHandler(async (req: Request, res: Response) => {
  const { permissions } = getContext(req)
  const catalog = listReportCatalog(permissions)
  return sendSuccess(res, 'Report catalog fetched', { reports: catalog })
})

export const queryReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { permissions } = getContext(req)
  const reportKey = getRouteParam(req, 'reportKey')
  const filters = req.body as ReportQueryBodyInput
  const result = await executeReport(tenantId, reportKey, filters, permissions)
  return sendSuccess(res, 'Report executed', result)
})

export const exportReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { permissions } = getContext(req)
  const reportKey = getRouteParam(req, 'reportKey')
  const filters = req.body as ReportQueryBodyInput
  const { csv } = await exportReportCsv(tenantId, reportKey, filters, permissions)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${reportKey}-export.csv"`)
  return res.send(csv)
})
