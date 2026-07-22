import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './phase7c2.controller.js'
import {
  assignPickListSchema,
  cancelPickListSchema,
  createPickListsSchema,
  dispatchLineIdParamSchema,
  dispatchOrderIdParamSchema,
  listPickListsQuerySchema,
  pickActionSchema,
  postReservationsSchema,
  previewReservationsSchema,
  reallocateReservationSchema,
  releaseReservationsSchema,
  shortageSchema,
} from './phase7c2.schemas.js'

const router = Router({ mergeParams: true })

router.post(
  '/orders/:id/reservations/preview',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.view'),
  validateBody(previewReservationsSchema),
  controller.previewReservations,
)

router.post(
  '/orders/:id/reservations',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.create'),
  validateBody(postReservationsSchema),
  controller.postReservations,
)

router.get(
  '/orders/:id/reservation-position',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.view'),
  controller.getReservationPosition,
)

router.get(
  '/orders/:id/reservations',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.view'),
  controller.listReservations,
)

router.post(
  '/orders/:id/reservations/release',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.release'),
  validateBody(releaseReservationsSchema),
  controller.releaseReservations,
)

router.post(
  '/orders/:id/reservations/reallocate',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.reservation.reallocate'),
  validateBody(reallocateReservationSchema),
  controller.reallocateReservation,
)

router.get(
  '/orders/:id/lines/:lineId/tracking-availability',
  validateParams(dispatchLineIdParamSchema),
  requirePermission('dispatch.tracking.view'),
  controller.trackingAvailability,
)

router.post(
  '/orders/:id/pick-lists',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.pick_list.create'),
  validateBody(createPickListsSchema),
  controller.createPickLists,
)

router.get(
  '/pick-lists',
  requirePermission('dispatch.pick_list.view'),
  validateQuery(listPickListsQuerySchema),
  controller.listPickLists,
)

router.get(
  '/pick-lists/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.view'),
  controller.getPickList,
)

router.post(
  '/pick-lists/:id/release',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.release'),
  controller.releasePickList,
)

router.post(
  '/pick-lists/:id/assign',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.assign'),
  validateBody(assignPickListSchema),
  controller.assignPickList,
)

router.post(
  '/pick-lists/:id/start',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.start'),
  controller.startPickList,
)

router.post(
  '/pick-lists/:id/pick',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.pick'),
  validateBody(pickActionSchema),
  controller.pickLine,
)

router.post(
  '/pick-lists/:id/report-shortage',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.report_shortage'),
  validateBody(shortageSchema),
  controller.reportShortage,
)

router.post(
  '/pick-lists/:id/resolve-shortage',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.resolve_shortage'),
  validateBody(shortageSchema),
  controller.resolveShortage,
)

router.post(
  '/pick-lists/:id/unpick',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.unpick'),
  validateBody(pickActionSchema),
  controller.unpickLine,
)

router.post(
  '/pick-lists/:id/complete',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.complete'),
  controller.completePickList,
)

router.post(
  '/pick-lists/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.pick_list.cancel'),
  validateBody(cancelPickListSchema),
  controller.cancelPickList,
)

router.get(
  '/orders/:id/picking-position',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.pick_list.view'),
  controller.getPickingPosition,
)

router.get(
  '/orders/:id/picking-reconciliation',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.pick_list.view'),
  controller.getPickingReconciliation,
)

router.get(
  '/workbench/reservations',
  requirePermission('dispatch.reservation.view'),
  controller.workbenchReservations,
)

router.get(
  '/workbench/pick-lists',
  requirePermission('dispatch.pick_list.view'),
  controller.workbenchPickLists,
)

router.get(
  '/workbench/picking',
  requirePermission('dispatch.pick_list.view'),
  controller.workbenchPicking,
)

router.get(
  '/workbench/picked',
  requirePermission('dispatch.pick_list.view'),
  controller.workbenchPicked,
)

router.get(
  '/workbench/shortages',
  requirePermission('dispatch.pick_list.view'),
  controller.workbenchShortages,
)

export default router
