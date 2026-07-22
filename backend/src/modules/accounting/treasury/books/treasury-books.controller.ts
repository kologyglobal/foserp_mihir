import type { Request, Response } from 'express'
import { getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { sendSuccess } from '../../../../utils/response.js'
import * as service from './treasury-books.service.js'
import type { BookQuery } from './treasury-books.schemas.js'

export const getBankbook = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'bankbook fetched', await service.getBankbook(getTenantId(req), req.query as unknown as BookQuery)))

export const getCashbook = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'cashbook fetched', await service.getCashbook(getTenantId(req), req.query as unknown as BookQuery)))

export const exportBankbookCsv = asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.getBankbookCsv(getTenantId(req), req.query as unknown as BookQuery)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="bankbook.csv"')
  res.send(csv)
})

export const exportCashbookCsv = asyncHandler(async (req: Request, res: Response) => {
  const csv = await service.getCashbookCsv(getTenantId(req), req.query as unknown as BookQuery)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="cashbook.csv"')
  res.send(csv)
})
