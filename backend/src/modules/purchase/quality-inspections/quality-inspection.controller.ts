import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendPaginated, sendSuccess } from '../../../utils/response.js'
import { getStockStatusForPurchaseQi } from '../../quality/incoming/incoming-stock-status.service.js'
import * as service from './quality-inspection.service.js'

const actor = (req: Request) => getContext(req).userId

export const listQualityInspections = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listQualityInspections(getTenantId(req), req.query as never)
  sendPaginated(
    res,
    'Quality inspections retrieved',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection retrieved',
    await service.getQualityInspection(getTenantId(req), getRouteParam(req, 'id')),
  ),
)

export const createQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection created',
    await service.createQualityInspection(getTenantId(req), actor(req), req.body),
    201,
  ),
)

export const updateQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection updated',
    await service.updateQualityInspection(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body,
    ),
  ),
)

export const completeQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection completed',
    await service.completeQualityInspection(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body ?? {},
    ),
  ),
)

export const acceptQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection accepted',
    await service.completeQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), {
      ...req.body,
      outcome: 'ACCEPT',
      decisionCode: req.body?.decisionCode ?? 'ACCEPT',
      decisionReason: req.body?.decisionReason ?? req.body?.remarks,
    }),
  ),
)

export const rejectQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection rejected',
    await service.completeQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req), {
      ...req.body,
      outcome: 'REJECT',
      decisionCode: req.body?.decisionCode ?? 'REJECT',
      decisionReason: req.body?.decisionReason ?? req.body?.remarks,
    }),
  ),
)

export const holdQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection held',
    await service.holdQualityInspection(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body ?? {},
    ),
  ),
)

export const cancelQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection cancelled',
    await service.cancelQualityInspection(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body ?? {},
    ),
  ),
)

export const getQiStockStatus = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'QI stock status',
    await getStockStatusForPurchaseQi(getTenantId(req), getRouteParam(req, 'id')),
  ),
)

export const getPurchaseReturnPrefill = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Purchase return prefill from QI',
    await service.getPurchaseReturnPrefillFromQi(getTenantId(req), getRouteParam(req, 'id')),
  ),
)

export const assignQualityInspector = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Inspector assigned',
    await service.assignQualityInspector(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body,
    ),
  ),
)

export const startQualityInspection = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Quality inspection started',
    await service.startQualityInspection(getTenantId(req), getRouteParam(req, 'id'), actor(req)),
  ),
)

export const createNcrFromQi = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'NCR created from QI',
    await service.createNcrFromPurchaseQi(
      getTenantId(req),
      getRouteParam(req, 'id'),
      actor(req),
      req.body ?? {},
    ),
    201,
  ),
)
