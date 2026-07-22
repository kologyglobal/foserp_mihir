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
  createFixedAssetSchema,
  depreciationPreviewSchema,
  disposeFixedAssetSchema,
  disposePreviewSchema,
  fixedAssetOverviewQuerySchema,
  listDepreciationRunsQuerySchema,
  listFixedAssetCategoriesQuerySchema,
  listFixedAssetTransfersQuerySchema,
  listFixedAssetsQuerySchema,
  createFixedAssetTransferSchema,
  completeFixedAssetTransferSchema,
  updateFixedAssetCategorySchema,
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

export default router
