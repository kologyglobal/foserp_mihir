import type { Request, Response } from 'express'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { listGrniRows } from './purchase-report.service.js'

export const getGrniReport = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!
  const vendorId = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined
  const data = await listGrniRows(tenantId, { vendorId, dateFrom, dateTo })
  res.json({ success: true, data })
})
