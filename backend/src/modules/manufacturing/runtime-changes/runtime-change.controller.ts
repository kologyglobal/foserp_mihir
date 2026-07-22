import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as service from './runtime-change.service.js'
import type {
  ApplyRuntimeChangeInput,
  ApproveRuntimeChangeInput,
  CancelRuntimeChangeInput,
  CreateRuntimeChangeInput,
  ListRuntimeChangesQuery,
  PreviewRuntimeChangeInput,
  RejectRuntimeChangeInput,
  UpdateRuntimeChangeInput,
} from './runtime-change.schemas.js'

/** Mounted under `/work-orders/:id/runtime-changes` — WO id param is `id`. */
function workOrderId(req: Request): string {
  return getRouteParam(req, 'id')
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(getTenantId(req), workOrderId(req), req.query as unknown as ListRuntimeChangesQuery)
  return sendPaginated(res, 'Runtime changes listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const get = asyncHandler(async (req, res) =>
  sendSuccess(res, 'Runtime change fetched', await service.getById(getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'))),
)

export const preview = asyncHandler(async (req, res) =>
  sendSuccess(res, 'Runtime change previewed', await service.preview(req, getTenantId(req), workOrderId(req), req.body as PreviewRuntimeChangeInput)),
)

export const create = asyncHandler(async (req, res) =>
  sendCreated(res, 'Runtime change drafted', await service.createDraft(req, getTenantId(req), workOrderId(req), req.body as CreateRuntimeChangeInput)),
)

export const update = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    'Runtime change updated',
    await service.updateDraft(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'), req.body as UpdateRuntimeChangeInput),
  ),
)

export const validate = asyncHandler(async (req, res) =>
  sendSuccess(res, 'Runtime change validated', await service.validateChange(getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'))),
)

export const submit = asyncHandler(async (req, res) =>
  sendSuccess(res, 'Runtime change submitted', await service.submit(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'))),
)

export const approve = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    'Runtime change approved',
    await service.approve(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'), req.body as ApproveRuntimeChangeInput),
  ),
)

export const reject = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    'Runtime change rejected',
    await service.reject(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'), req.body as RejectRuntimeChangeInput),
  ),
)

export const apply = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    'Runtime change applied',
    await service.apply(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'), req.body as ApplyRuntimeChangeInput),
  ),
)

export const cancel = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    'Runtime change cancelled',
    await service.cancel(req, getTenantId(req), workOrderId(req), getRouteParam(req, 'changeId'), req.body as CancelRuntimeChangeInput),
  ),
)
