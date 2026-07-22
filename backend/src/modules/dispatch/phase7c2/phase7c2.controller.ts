import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import * as pickService from '../picking/dispatch-pick-list.service.js'
import * as reconcileService from '../picking/dispatch-picking-reconciliation.service.js'
import * as reservationService from '../reservation/dispatch-reservation.service.js'
import type {
  AssignPickListInput,
  CreatePickListsInput,
  ListPickListsQuery,
  PickActionInput,
  PostReservationsInput,
  PreviewReservationsInput,
  ReallocateReservationInput,
  ReleaseReservationsInput,
  ShortageInput,
} from './phase7c2.schemas.js'

export const previewReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const body = req.body as PreviewReservationsInput
  const data = await reservationService.previewReservation(tenantId, dispatchId, body.lines)
  return sendSuccess(res, 'Reservation preview', data)
})

export const postReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reservationService.postReservations(
    req,
    tenantId,
    dispatchId,
    req.body as PostReservationsInput,
  )
  return sendCreated(res, 'Reservations posted', data)
})

export const getReservationPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reservationService.getReservationPosition(tenantId, dispatchId)
  return sendSuccess(res, 'Reservation position', data)
})

export const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reservationService.listReservationsForDispatch(tenantId, dispatchId)
  return sendSuccess(res, 'Dispatch reservations', data)
})

export const releaseReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reservationService.releaseReservations(
    req,
    tenantId,
    dispatchId,
    req.body as ReleaseReservationsInput,
  )
  return sendSuccess(res, 'Reservations released', data)
})

export const reallocateReservation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reservationService.reallocateReservation(
    req,
    tenantId,
    dispatchId,
    req.body as ReallocateReservationInput,
  )
  return sendSuccess(res, 'Reservation reallocated', data)
})

export const trackingAvailability = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const lineId = getRouteParam(req, 'lineId')
  const data = await reservationService.getTrackingAvailability(tenantId, dispatchId, lineId)
  return sendSuccess(res, 'Tracking availability', data)
})

export const createPickLists = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await pickService.createPickListsFromDispatch(
    req,
    tenantId,
    dispatchId,
    req.body as CreatePickListsInput,
  )
  return sendCreated(res, 'Pick lists created', data)
})

export const listPickLists = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const query = req.query as unknown as ListPickListsQuery
  const result = await pickService.listPickLists(tenantId, query)
  return sendPaginated(
    res,
    'Pick lists',
    result.items,
    buildPaginationMeta(result.total, query.page, query.limit),
  )
})

export const getPickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.getPickList(tenantId, pickListId)
  return sendSuccess(res, 'Pick list', data)
})

export const releasePickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.releasePickList(req, tenantId, pickListId)
  return sendSuccess(res, 'Pick list released', data)
})

export const assignPickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.assignPickList(
    req,
    tenantId,
    pickListId,
    req.body as AssignPickListInput,
  )
  return sendSuccess(res, 'Pick list assigned', data)
})

export const startPickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.startPickList(req, tenantId, pickListId)
  return sendSuccess(res, 'Pick list started', data)
})

export const pickLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.pickLine(req, tenantId, pickListId, req.body as PickActionInput)
  return sendSuccess(res, 'Pick recorded', data)
})

export const reportShortage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.reportShortage(req, tenantId, pickListId, req.body as ShortageInput)
  return sendSuccess(res, 'Shortage recorded', data)
})

export const resolveShortage = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.resolveShortage(req, tenantId, pickListId, req.body as ShortageInput)
  return sendSuccess(res, 'Shortage resolved', data)
})

export const unpickLine = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.unpickLine(req, tenantId, pickListId, req.body as PickActionInput)
  return sendSuccess(res, 'Unpick recorded', data)
})

export const completePickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const data = await pickService.completePickList(req, tenantId, pickListId)
  return sendSuccess(res, 'Pick list completed', data)
})

export const cancelPickList = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const pickListId = getRouteParam(req, 'id')
  const body = req.body as { reason?: string }
  const data = await pickService.cancelPickList(req, tenantId, pickListId, body.reason)
  return sendSuccess(res, 'Pick list cancelled', data)
})

export const getPickingPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await pickService.getPickingPosition(tenantId, dispatchId)
  return sendSuccess(res, 'Picking position', data)
})

export const getPickingReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dispatchId = getRouteParam(req, 'id')
  const data = await reconcileService.getPickingReconciliation(tenantId, dispatchId)
  return sendSuccess(res, 'Picking reconciliation', data)
})

export const workbenchReservations = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchReservations(tenantId)
  return sendSuccess(res, 'Workbench reservations', data)
})

export const workbenchPickLists = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchPickLists(tenantId)
  return sendSuccess(res, 'Workbench pick lists', data)
})

export const workbenchPicking = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchPickLists(tenantId, 50)
  return sendSuccess(res, 'Workbench picking', data)
})

export const workbenchPicked = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const rows = await reconcileService.getWorkbenchPickLists(tenantId, 50)
  return sendSuccess(
    res,
    'Workbench picked',
    rows.filter((r) => r.status === 'PICKED'),
  )
})

export const workbenchShortages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await reconcileService.getWorkbenchShortages(tenantId)
  return sendSuccess(res, 'Workbench shortages', data)
})
