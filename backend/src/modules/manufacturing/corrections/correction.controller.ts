import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './correction.service.js'
import type {
  ApplyCorrectionInput,
  CancelCorrectionInput,
  CreateCorrectionInput,
  ListCorrectionsQuery,
  PreviewCorrectionInput,
  RejectCorrectionInput,
  UpdateCorrectionInput,
} from './correction.schemas.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(getTenantId(req), req.query as unknown as ListCorrectionsQuery)
  return sendPaginated(
    res,
    'Corrections listed',
    result.items,
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const preview = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction impact preview',
    await service.preview(req, getTenantId(req), req.body as PreviewCorrectionInput),
  ),
)

export const create = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(
    res,
    'Correction drafted',
    await service.create(req, getTenantId(req), req.body as CreateCorrectionInput),
  ),
)

export const get = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'Correction fetched', await service.get(getTenantId(req), getRouteParam(req, 'correctionId'))),
)

export const update = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction updated',
    await service.update(
      req,
      getTenantId(req),
      getRouteParam(req, 'correctionId'),
      req.body as UpdateCorrectionInput,
    ),
  ),
)

export const submit = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction submitted',
    await service.submit(req, getTenantId(req), getRouteParam(req, 'correctionId')),
  ),
)

export const approve = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction approved',
    await service.approve(req, getTenantId(req), getRouteParam(req, 'correctionId')),
  ),
)

export const reject = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction rejected',
    await service.reject(
      req,
      getTenantId(req),
      getRouteParam(req, 'correctionId'),
      req.body as RejectCorrectionInput,
    ),
  ),
)

export const apply = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction applied',
    await service.apply(
      req,
      getTenantId(req),
      getRouteParam(req, 'correctionId'),
      (req.body ?? {}) as ApplyCorrectionInput,
    ),
  ),
)

export const cancel = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction cancelled',
    await service.cancel(
      req,
      getTenantId(req),
      getRouteParam(req, 'correctionId'),
      (req.body ?? {}) as CancelCorrectionInput,
    ),
  ),
)

export const dependencies = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction dependencies',
    await service.dependencies(getTenantId(req), getRouteParam(req, 'correctionId')),
  ),
)

export const history = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    'Correction history',
    await service.history(
      getTenantId(req),
      getRouteParam(req, 'entityType'),
      getRouteParam(req, 'entityId'),
    ),
  ),
)
