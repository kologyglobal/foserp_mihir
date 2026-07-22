import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as packingService from '../packing/dispatch-packing.service.js'
import * as packageService from '../packing/dispatch-package.service.js'
import * as reconcileService from '../packing/dispatch-packing-reconciliation.service.js'
import type {
  CreatePackageInput,
  CreatePackageTypeInput,
  CreatePackingSessionInput,
  ListPackingSessionsQuery,
  MoveLinesInput,
  PackActionInput,
  PackingShortageInput,
  UnpackActionInput,
  UpdatePackageInput,
  UpdatePackageTypeInput,
} from './phase7c3.schemas.js'

export const createPackingSessions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await packingService.createSessionFromDispatch(
    req,
    tenantId,
    dispatchId,
    req.body as CreatePackingSessionInput,
  )
  return sendCreated(res, 'Packing sessions created', data)
})

export const listPackingSessions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListPackingSessionsQuery
  const result = await packingService.listSessions(tenantId, query)
  return sendPaginated(
    res,
    'Packing sessions',
    result.items,
    buildPaginationMeta(result.total, query.page, query.limit),
  )
})

export const getPackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.getSession(tenantId, sessionId)
  return sendSuccess(res, 'Packing session', data)
})

export const startPackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.startSession(req, tenantId, sessionId)
  return sendSuccess(res, 'Packing session started', data)
})

export const completePackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.completeSession(req, tenantId, sessionId)
  return sendSuccess(res, 'Packing session completed', data)
})

export const verifyPackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.verifySession(req, tenantId, sessionId)
  return sendSuccess(res, 'Packing session verified', data)
})

export const reopenPackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.reopenSession(req, tenantId, sessionId)
  return sendSuccess(res, 'Packing session reopened', data)
})

export const cancelPackingSession = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const body = req.body as { reason?: string }
  const data = await packingService.cancelSession(req, tenantId, sessionId, body.reason)
  return sendSuccess(res, 'Packing session cancelled', data)
})

export const listPackages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packageService.listPackagesForSession(tenantId, sessionId)
  return sendSuccess(res, 'Packages', data)
})

export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packageService.createPackage(req, tenantId, sessionId, req.body as CreatePackageInput)
  return sendCreated(res, 'Package created', data)
})

export const getPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.getPackage(tenantId, packageId)
  return sendSuccess(res, 'Package', data)
})

export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.updatePackage(req, tenantId, packageId, req.body as UpdatePackageInput)
  return sendSuccess(res, 'Package updated', data)
})

export const packIntoPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.packIntoPackage(req, tenantId, packageId, req.body as PackActionInput)
  return sendSuccess(res, 'Pack recorded', data)
})

export const unpackFromPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.unpackFromPackage(req, tenantId, packageId, req.body as UnpackActionInput)
  return sendSuccess(res, 'Unpack recorded', data)
})

export const movePackageLines = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.moveLinesBetweenPackages(
    req,
    tenantId,
    packageId,
    req.body as MoveLinesInput,
  )
  return sendSuccess(res, 'Lines moved', data)
})

export const completePackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.completePackage(req, tenantId, packageId)
  return sendSuccess(res, 'Package completed', data)
})

export const verifyPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.verifyPackage(req, tenantId, packageId)
  return sendSuccess(res, 'Package verified', data)
})

export const reopenPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const data = await packageService.reopenPackage(req, tenantId, packageId)
  return sendSuccess(res, 'Package reopened', data)
})

export const cancelPackage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const packageId = getRouteParam(req, 'id')
  const body = req.body as { reason?: string }
  const data = await packageService.cancelPackage(req, tenantId, packageId, body.reason)
  return sendSuccess(res, 'Package cancelled', data)
})

export const reportPackingShortage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.reportPackingShortage(
    req,
    tenantId,
    sessionId,
    req.body as PackingShortageInput,
  )
  return sendSuccess(res, 'Packing shortage recorded', data)
})

export const resolvePackingShortage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await packingService.resolvePackingShortage(
    req,
    tenantId,
    sessionId,
    req.body as PackingShortageInput,
  )
  return sendSuccess(res, 'Packing shortage resolved', data)
})

export const getPackingPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await packingService.getPackingPosition(tenantId, dispatchId)
  return sendSuccess(res, 'Packing position', data)
})

export const getPackingReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reconcileService.getPackingReconciliation(tenantId, dispatchId)
  return sendSuccess(res, 'Packing reconciliation', data)
})

export const getSessionReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const sessionId = getRouteParam(req, 'id')
  const data = await reconcileService.getSessionReconciliation(tenantId, sessionId)
  return sendSuccess(res, 'Session reconciliation', data)
})

export const listPackageTypes = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const activeOnly = req.query.activeOnly !== 'false'
  const data = await packingService.listPackageTypes(tenantId, activeOnly)
  return sendSuccess(res, 'Package types', data)
})

export const createPackageType = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await packingService.createPackageType(req, tenantId, req.body as CreatePackageTypeInput)
  return sendCreated(res, 'Package type created', data)
})

export const updatePackageType = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const typeId = getRouteParam(req, 'id')
  const data = await packingService.updatePackageType(req, tenantId, typeId, req.body as UpdatePackageTypeInput)
  return sendSuccess(res, 'Package type updated', data)
})

export const workbenchPacking = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchPackingInProgress(tenantId)
  return sendSuccess(res, 'Workbench packing', data)
})

export const workbenchPacked = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchPackedSessions(tenantId)
  return sendSuccess(res, 'Workbench packed', data)
})

export const workbenchPackingShortages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchPackingShortages(tenantId)
  return sendSuccess(res, 'Workbench packing shortages', data)
})

export const workbenchReadyToPack = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchReadyToPack(tenantId)
  return sendSuccess(res, 'Workbench ready to pack', data)
})
