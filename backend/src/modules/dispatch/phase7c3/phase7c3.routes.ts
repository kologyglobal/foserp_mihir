import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './phase7c3.controller.js'
import {
  cancelPackageSchema,
  cancelPackingSessionSchema,
  createPackageSchema,
  createPackageTypeSchema,
  createPackingSessionSchema,
  dispatchOrderIdParamSchema,
  listPackingSessionsQuerySchema,
  moveLinesSchema,
  packActionSchema,
  packingShortageSchema,
  unpackActionSchema,
  updatePackageSchema,
  updatePackageTypeSchema,
  uuidParamSchema,
} from './phase7c3.schemas.js'

const router = Router({ mergeParams: true })

router.post(
  '/orders/:id/packing-sessions',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.packing.create'),
  validateBody(createPackingSessionSchema),
  controller.createPackingSessions,
)

router.get(
  '/packing-sessions',
  requirePermission('dispatch.packing.view'),
  validateQuery(listPackingSessionsQuerySchema),
  controller.listPackingSessions,
)

router.get(
  '/packing-sessions/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.view'),
  controller.getPackingSession,
)

router.post(
  '/packing-sessions/:id/start',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.start'),
  controller.startPackingSession,
)

router.post(
  '/packing-sessions/:id/complete',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.complete'),
  controller.completePackingSession,
)

router.post(
  '/packing-sessions/:id/verify',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.verify'),
  controller.verifyPackingSession,
)

router.post(
  '/packing-sessions/:id/reopen',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.reopen'),
  controller.reopenPackingSession,
)

router.post(
  '/packing-sessions/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.cancel'),
  validateBody(cancelPackingSessionSchema),
  controller.cancelPackingSession,
)

router.get(
  '/packing-sessions/:id/packages',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.view'),
  controller.listPackages,
)

router.post(
  '/packing-sessions/:id/packages',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.create'),
  validateBody(createPackageSchema),
  controller.createPackage,
)

router.get(
  '/packages/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.view'),
  controller.getPackage,
)

router.patch(
  '/packages/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.edit'),
  validateBody(updatePackageSchema),
  controller.updatePackage,
)

router.post(
  '/packages/:id/pack',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.pack'),
  validateBody(packActionSchema),
  controller.packIntoPackage,
)

router.post(
  '/packages/:id/unpack',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.unpack'),
  validateBody(unpackActionSchema),
  controller.unpackFromPackage,
)

router.post(
  '/packages/:id/move-lines',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.move'),
  validateBody(moveLinesSchema),
  controller.movePackageLines,
)

router.post(
  '/packages/:id/complete',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.complete'),
  controller.completePackage,
)

router.post(
  '/packages/:id/verify',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.verify'),
  controller.verifyPackage,
)

router.post(
  '/packages/:id/reopen',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.reopen'),
  controller.reopenPackage,
)

router.post(
  '/packages/:id/cancel',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.package.cancel'),
  validateBody(cancelPackageSchema),
  controller.cancelPackage,
)

router.post(
  '/packing-sessions/:id/report-shortage',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing_shortage.report'),
  validateBody(packingShortageSchema),
  controller.reportPackingShortage,
)

router.post(
  '/packing-sessions/:id/resolve-shortage',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing_shortage.resolve'),
  validateBody(packingShortageSchema),
  controller.resolvePackingShortage,
)

router.get(
  '/orders/:id/packing-position',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.packing.view'),
  controller.getPackingPosition,
)

router.get(
  '/orders/:id/packing-reconciliation',
  validateParams(dispatchOrderIdParamSchema),
  requirePermission('dispatch.packing_reports.view'),
  controller.getPackingReconciliation,
)

router.get(
  '/packing-sessions/:id/reconciliation',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing_reports.view'),
  controller.getSessionReconciliation,
)

router.get(
  '/package-types',
  requirePermission('dispatch.packing.view'),
  controller.listPackageTypes,
)

router.post(
  '/package-types',
  requirePermission('dispatch.packing.edit'),
  validateBody(createPackageTypeSchema),
  controller.createPackageType,
)

router.patch(
  '/package-types/:id',
  validateParams(uuidParamSchema),
  requirePermission('dispatch.packing.edit'),
  validateBody(updatePackageTypeSchema),
  controller.updatePackageType,
)

router.get(
  '/workbench/packing',
  requirePermission('dispatch.packing.view'),
  controller.workbenchPacking,
)

router.get(
  '/workbench/packed',
  requirePermission('dispatch.packing.view'),
  controller.workbenchPacked,
)

router.get(
  '/workbench/packing-shortages',
  requirePermission('dispatch.packing_shortage.view'),
  controller.workbenchPackingShortages,
)

export default router
