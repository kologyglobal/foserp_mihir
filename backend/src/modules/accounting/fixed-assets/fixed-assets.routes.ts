import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import {
  capitalizeFixedAssetSchema,
  createDepreciationRunSchema,
  createFixedAssetCategorySchema,
  createFixedAssetImpairmentSchema,
  createFixedAssetMaintenanceSchema,
  createFixedAssetRevaluationSchema,
  createFixedAssetSchema,
  createFixedAssetTransferSchema,
  completeFixedAssetMaintenanceSchema,
  completeFixedAssetTransferSchema,
  depreciationPreviewSchema,
  disposeFixedAssetSchema,
  disposePreviewSchema,
  fixedAssetOverviewQuerySchema,
  fixedAssetReportQuerySchema,
  listDepreciationRunsQuerySchema,
  listFixedAssetCategoriesQuerySchema,
  listFixedAssetPhase4QuerySchema,
  listFixedAssetTransfersQuerySchema,
  listFixedAssetsQuerySchema,
  updateFixedAssetCategorySchema,
  updateFixedAssetMaintenanceSchema,
  updateFixedAssetSchema,
} from './fixed-assets.schemas.js'
import * as controller from './fixed-assets.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

router.get(
  '/overview',
  requirePermission('finance.fa.view'),
  validateQuery(fixedAssetOverviewQuerySchema),
  controller.getOverview,
)

router.get(
  '/categories',
  requirePermission('finance.fa.view'),
  validateQuery(listFixedAssetCategoriesQuerySchema),
  controller.listCategories,
)

router.post(
  '/categories',
  requirePermission('finance.fa.create'),
  validateBody(createFixedAssetCategorySchema),
  controller.createCategory,
)

router.get(
  '/categories/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.view'),
  controller.getCategory,
)

router.patch(
  '/categories/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.edit'),
  validateBody(updateFixedAssetCategorySchema),
  controller.updateCategory,
)

router.get(
  '/assets',
  requirePermission('finance.fa.view'),
  validateQuery(listFixedAssetsQuerySchema),
  controller.listAssets,
)

router.post(
  '/assets',
  requirePermission('finance.fa.create'),
  validateBody(createFixedAssetSchema),
  controller.createAsset,
)

router.get(
  '/assets/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.view'),
  controller.getAsset,
)

router.patch(
  '/assets/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.edit'),
  validateBody(updateFixedAssetSchema),
  controller.updateAsset,
)

router.post(
  '/assets/:id/capitalize',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.capitalize'),
  validateBody(capitalizeFixedAssetSchema),
  controller.capitalizeAsset,
)

router.post(
  '/assets/:id/dispose/preview',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.dispose'),
  validateBody(disposePreviewSchema),
  controller.previewDisposeAsset,
)

router.post(
  '/assets/:id/dispose',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.dispose'),
  validateBody(disposeFixedAssetSchema),
  controller.disposeAsset,
)

router.get(
  '/transfers',
  requirePermission('finance.fa.view'),
  validateQuery(listFixedAssetTransfersQuerySchema),
  controller.listTransfers,
)

router.post(
  '/transfers',
  requirePermission('finance.fa.transfer'),
  validateBody(createFixedAssetTransferSchema),
  controller.createTransfer,
)

router.get(
  '/transfers/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.view'),
  controller.getTransfer,
)

router.post(
  '/transfers/:id/complete',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.transfer'),
  validateBody(completeFixedAssetTransferSchema),
  controller.completeTransfer,
)

router.get(
  '/depreciation-runs',
  requirePermission('finance.fa.view'),
  validateQuery(listDepreciationRunsQuerySchema),
  controller.listDepreciationRuns,
)

router.post(
  '/depreciation-runs/preview',
  requirePermission('finance.fa.depreciate'),
  validateBody(depreciationPreviewSchema),
  controller.previewDepreciationRun,
)

router.post(
  '/depreciation-runs',
  requirePermission('finance.fa.depreciate'),
  validateBody(createDepreciationRunSchema),
  controller.createDepreciationRun,
)

router.get(
  '/depreciation-runs/:id',
  validateParams(uuidParamSchema),
  requirePermission('finance.fa.view'),
  controller.getDepreciationRun,
)

// ─── Phase 4 — revaluation / impairment / maintenance / reports ──────────────

router.get('/revaluations', requirePermission('finance.fa.view'), validateQuery(listFixedAssetPhase4QuerySchema), controller.listRevaluations)
router.post('/revaluations', requirePermission('finance.fa.revalue'), validateBody(createFixedAssetRevaluationSchema), controller.createRevaluation)
router.get('/revaluations/:id', validateParams(uuidParamSchema), requirePermission('finance.fa.view'), controller.getRevaluation)
router.post('/revaluations/:id/post', validateParams(uuidParamSchema), requirePermission('finance.fa.revalue'), controller.postRevaluation)
router.post('/revaluations/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.fa.revalue'), controller.cancelRevaluation)

router.get('/impairments', requirePermission('finance.fa.view'), validateQuery(listFixedAssetPhase4QuerySchema), controller.listImpairments)
router.post('/impairments', requirePermission('finance.fa.impair'), validateBody(createFixedAssetImpairmentSchema), controller.createImpairment)
router.get('/impairments/:id', validateParams(uuidParamSchema), requirePermission('finance.fa.view'), controller.getImpairment)
router.post('/impairments/:id/recognize', validateParams(uuidParamSchema), requirePermission('finance.fa.impair'), controller.recognizeImpairment)
router.post('/impairments/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.fa.impair'), controller.cancelImpairment)

router.get('/maintenance', requirePermission('finance.fa.view'), validateQuery(listFixedAssetPhase4QuerySchema), controller.listMaintenance)
router.post('/maintenance', requirePermission('finance.fa.maintain'), validateBody(createFixedAssetMaintenanceSchema), controller.createMaintenance)
router.get('/maintenance/:id', validateParams(uuidParamSchema), requirePermission('finance.fa.view'), controller.getMaintenance)
router.patch('/maintenance/:id', validateParams(uuidParamSchema), requirePermission('finance.fa.maintain'), validateBody(updateFixedAssetMaintenanceSchema), controller.updateMaintenance)
router.post('/maintenance/:id/complete', validateParams(uuidParamSchema), requirePermission('finance.fa.maintain'), validateBody(completeFixedAssetMaintenanceSchema), controller.completeMaintenance)
router.post('/maintenance/:id/cancel', validateParams(uuidParamSchema), requirePermission('finance.fa.maintain'), controller.cancelMaintenance)

router.get('/reports/summary', requirePermission('finance.fa.view'), validateQuery(fixedAssetReportQuerySchema), controller.reportSummary)
router.get('/reports/nbv-by-category', requirePermission('finance.fa.view'), validateQuery(fixedAssetReportQuerySchema), controller.reportNbvByCategory)
router.get('/reports/register', requirePermission('finance.fa.view'), validateQuery(fixedAssetReportQuerySchema), controller.reportRegister)
router.get('/reports/disposals', requirePermission('finance.fa.view'), validateQuery(fixedAssetReportQuerySchema), controller.reportDisposals)

export default router
