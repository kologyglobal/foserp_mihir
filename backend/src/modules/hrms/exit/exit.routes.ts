import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './exit.controller.js'
import {
  approveExitSchema,
  assetLineIdParamSchema,
  cancelExitSchema,
  clearClearanceLineSchema,
  clearanceLineIdParamSchema,
  createAssetLineSchema,
  createExitSchema,
  exitIdParamSchema,
  listExitsQuerySchema,
  listMyExitsQuerySchema,
  setAssetStatusSchema,
  updateAssetLineSchema,
  updateExitDraftSchema,
  waiveClearanceLineSchema,
} from './exit.schemas.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('hrms.exit.view'), validateQuery(listExitsQuerySchema), controller.listExits)
router.post('/', requirePermission('hrms.exit.create'), validateBody(createExitSchema), controller.createExit)
router.get('/mine', validateQuery(listMyExitsQuerySchema), controller.listMine)
router.get('/:exitId', validateParams(exitIdParamSchema), requirePermission('hrms.exit.view'), controller.getExit)
router.patch(
  '/:exitId',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.create'),
  validateBody(updateExitDraftSchema),
  controller.updateDraft,
)

router.post('/:exitId/submit', validateParams(exitIdParamSchema), requirePermission('hrms.exit.create'), controller.submitExit)
router.post(
  '/:exitId/approve',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.approve'),
  validateBody(approveExitSchema),
  controller.approveExit,
)
router.post(
  '/:exitId/cancel',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.create'),
  validateBody(cancelExitSchema),
  controller.cancelExit,
)

// ─── Clearance ───────────────────────────────────────────────────────────
router.get(
  '/:exitId/clearance',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.view'),
  controller.listClearance,
)
router.post(
  '/:exitId/clearance/seed',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  controller.seedClearance,
)
router.post(
  '/:exitId/clearance/:lineId/clear',
  validateParams(clearanceLineIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  validateBody(clearClearanceLineSchema),
  controller.clearLine,
)
router.post(
  '/:exitId/clearance/:lineId/waive',
  validateParams(clearanceLineIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  validateBody(waiveClearanceLineSchema),
  controller.waiveLine,
)

// ─── Asset lines ──────────────────────────────────────────────────────────
router.get(
  '/:exitId/assets',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.view'),
  controller.listAssetLines,
)
router.post(
  '/:exitId/assets',
  validateParams(exitIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  validateBody(createAssetLineSchema),
  controller.addAssetLine,
)
router.patch(
  '/:exitId/assets/:assetLineId',
  validateParams(assetLineIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  validateBody(updateAssetLineSchema),
  controller.updateAssetLine,
)
router.delete(
  '/:exitId/assets/:assetLineId',
  validateParams(assetLineIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  controller.removeAssetLine,
)
router.post(
  '/:exitId/assets/:assetLineId/status',
  validateParams(assetLineIdParamSchema),
  requirePermission('hrms.exit.clearance'),
  validateBody(setAssetStatusSchema),
  controller.setAssetStatus,
)

export default router
