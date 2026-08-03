import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as exits from './exit.service.js'
import * as clearance from './exit-clearance.service.js'
import type {
  ApproveExitInput,
  CancelExitInput,
  ClearClearanceLineInput,
  CreateAssetLineInput,
  CreateExitInput,
  ListExitsQuery,
  ListMyExitsQuery,
  SetAssetStatusInput,
  UpdateAssetLineInput,
  UpdateExitDraftInput,
  WaiveClearanceLineInput,
} from './exit.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

function hasPerm(req: Request, name: string): boolean {
  return Boolean(req.context?.permissions?.includes(name))
}

// ─── Exit lifecycle ────────────────────────────────────────────────────────

export const listExits = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await exits.listExits(getTenantId(req), scope, req.query as unknown as ListExitsQuery)
  return sendPaginated(res, 'Exits listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const result = await exits.listMine(getTenantId(req), req.context!.userId, req.query as unknown as ListMyExitsQuery)
  return sendPaginated(res, 'My exits listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const getExit = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.getExit(getTenantId(req), getRouteParam(req, 'exitId'), scope)
  return sendSuccess(res, 'Exit fetched', item)
})

export const createExit = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.createExit(getTenantId(req), req.context!.userId, req.body as CreateExitInput, scope, auditMeta(req))
  return sendCreated(res, 'Exit created', item)
})

export const updateDraft = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.updateDraft(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    req.body as UpdateExitDraftInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Exit updated', item)
})

export const submitExit = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.submitExit(getTenantId(req), req.context!.userId, getRouteParam(req, 'exitId'), scope, auditMeta(req))
  return sendSuccess(res, 'Exit submitted', item)
})

export const approveExit = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.approveExit(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    req.body as ApproveExitInput,
    scope,
    hasPerm(req, 'hrms.exit.approve'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Exit approved', item)
})

export const cancelExit = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await exits.cancelExit(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    (req.body as CancelExitInput).reason,
    scope,
    hasPerm(req, 'hrms.exit.approve'),
    auditMeta(req),
  )
  return sendSuccess(res, 'Exit cancelled', item)
})

// ─── Clearance ─────────────────────────────────────────────────────────────

export const listClearance = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const items = await clearance.listClearance(getTenantId(req), getRouteParam(req, 'exitId'), scope)
  return sendSuccess(res, 'Clearance checklist fetched', items)
})

export const seedClearance = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const items = await clearance.seedClearance(getTenantId(req), getRouteParam(req, 'exitId'), scope, auditMeta(req))
  return sendCreated(res, 'Clearance checklist seeded', items)
})

export const clearLine = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await clearance.clearLine(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    getRouteParam(req, 'lineId'),
    (req.body as ClearClearanceLineInput).remarks,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Clearance line cleared', result)
})

export const waiveLine = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await clearance.waiveLine(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    getRouteParam(req, 'lineId'),
    (req.body as WaiveClearanceLineInput).reason,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Clearance line waived', result)
})

// ─── Asset lines ────────────────────────────────────────────────────────────

export const listAssetLines = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const items = await clearance.listAssetLines(getTenantId(req), getRouteParam(req, 'exitId'), scope)
  return sendSuccess(res, 'Asset lines fetched', items)
})

export const addAssetLine = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await clearance.addAssetLine(
    getTenantId(req),
    getRouteParam(req, 'exitId'),
    req.body as CreateAssetLineInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Asset line added', item)
})

export const updateAssetLine = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await clearance.updateAssetLine(
    getTenantId(req),
    getRouteParam(req, 'exitId'),
    getRouteParam(req, 'assetLineId'),
    req.body as UpdateAssetLineInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Asset line updated', item)
})

export const removeAssetLine = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  await clearance.removeAssetLine(getTenantId(req), getRouteParam(req, 'exitId'), getRouteParam(req, 'assetLineId'), scope, auditMeta(req))
  return sendSuccess(res, 'Asset line removed', null)
})

export const setAssetStatus = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const result = await clearance.setAssetStatus(
    getTenantId(req),
    req.context!.userId,
    getRouteParam(req, 'exitId'),
    getRouteParam(req, 'assetLineId'),
    req.body as SetAssetStatusInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Asset line status updated', result)
})
