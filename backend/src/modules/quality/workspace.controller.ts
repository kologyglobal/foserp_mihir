import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import { getIncomingQualityReports } from './incoming/incoming-reports.service.js'
import {
  getStockStatusForGrn,
  getStockStatusForItem,
  getStockStatusForPurchaseQi,
} from './incoming/incoming-stock-status.service.js'
import {
  assignIncomingInspector,
  getIncomingQueueLegacy,
  getIncomingWorkbench,
  incomingQueueQuerySchema,
  startIncomingInspection,
} from './incoming/incoming-workbench.service.js'
import { getWorkspaceSummary } from './workspace.service.js'

export const summary = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Quality workspace summary fetched', await getWorkspaceSummary(getTenantId(req))))

/** Enhanced incoming command-center queue (filters + line items). */
export const incoming = asyncHandler(async (req: Request, res: Response) => {
  const parsed = incomingQueueQuerySchema.safeParse(req.query)
  const query = parsed.success ? parsed.data : { page: 1, limit: 50 }
  const data = await getIncomingWorkbench(getTenantId(req), query)
  sendSuccess(res, 'Incoming QC workbench fetched', data)
})

/** Backward-compatible flat queue. */
export const incomingLegacy = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Incoming QC queue fetched', await getIncomingQueueLegacy(getTenantId(req))))

export const incomingReports = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Incoming quality reports', await getIncomingQualityReports(getTenantId(req))))

export const assignInspector = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getContext(req).userId
  sendSuccess(
    res,
    'Inspector assigned',
    await assignIncomingInspector(getTenantId(req), actorId, req.body),
  )
})

export const startInspection = asyncHandler(async (req: Request, res: Response) => {
  const actorId = getContext(req).userId
  sendSuccess(
    res,
    'Inspection started',
    await startIncomingInspection(getTenantId(req), actorId, req.body),
  )
})

export const stockStatusGrn = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'GRN stock status',
    await getStockStatusForGrn(getTenantId(req), getRouteParam(req, 'goodsReceiptId')),
  ))

export const stockStatusQi = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'QI stock status',
    await getStockStatusForPurchaseQi(getTenantId(req), getRouteParam(req, 'qualityInspectionId')),
  ))

export const stockStatusItem = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Item stock status',
    await getStockStatusForItem(getTenantId(req), getRouteParam(req, 'itemId'), {
      warehouseId: typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined,
    }),
  ))
