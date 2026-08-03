import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireAnyPermission, requirePermission } from '../../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './costing.controller.js'
import {
  listCostEntriesQuerySchema,
  listCostLayersQuerySchema,
  listVariancesQuerySchema,
  methodChangeBodySchema,
  upsertStandardCostBodySchema,
  valuationReconciliationQuerySchema,
  effectiveMethodQuerySchema,
  itemCostingSummaryParamSchema,
  listValuationItemsQuerySchema,
  listMovingAverageQuerySchema,
  listStandardCostsQuerySchema,
  listSpecificQuerySchema,
  runReconciliationBodySchema,
  methodChangePreviewQuerySchema,
  listMovingAverageHistoryQuerySchema,
} from './costing.schemas.js'

const router = Router({ mergeParams: true })

const viewPerms = [
  'inventory.view_cost',
  'inventory.stock.view',
  'inventory.view_item_ledger',
  'inventory.view',
] as const

router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)

router.get('/overview', requireAnyPermission(...viewPerms), controller.getCostingOverview)

router.get(
  '/items',
  requireAnyPermission(...viewPerms),
  validateQuery(listValuationItemsQuerySchema),
  controller.listValuationItems,
)

router.get(
  '/items/:itemId/summary',
  requireAnyPermission(...viewPerms),
  validateParams(itemCostingSummaryParamSchema),
  controller.getItemCostingSummary,
)

router.get(
  '/cost-entries',
  requireAnyPermission(...viewPerms),
  validateQuery(listCostEntriesQuerySchema),
  controller.listCostEntries,
)

router.get(
  '/cost-entries/:id',
  requireAnyPermission(...viewPerms),
  validateParams(uuidParamSchema),
  controller.getCostEntry,
)

router.get(
  '/cost-layers',
  requireAnyPermission(...viewPerms),
  validateQuery(listCostLayersQuerySchema),
  controller.listCostLayers,
)

router.get(
  '/cost-layers/:id',
  requireAnyPermission(...viewPerms),
  validateParams(uuidParamSchema),
  controller.getCostLayer,
)

router.get(
  '/moving-average',
  requireAnyPermission(...viewPerms),
  validateQuery(listMovingAverageQuerySchema),
  controller.listMovingAverage,
)

router.get(
  '/standard-costs',
  requireAnyPermission(...viewPerms),
  validateQuery(listStandardCostsQuerySchema),
  controller.listStandardCosts,
)

router.get(
  '/specific',
  requireAnyPermission(...viewPerms),
  validateQuery(listSpecificQuerySchema),
  controller.listSpecificIdentification,
)

router.get(
  '/valuation-reconciliation',
  requireAnyPermission(...viewPerms, 'inventory.view_audit'),
  validateQuery(valuationReconciliationQuerySchema),
  controller.getValuationReconciliation,
)

router.post(
  '/reconciliation/run',
  requireAnyPermission(...viewPerms, 'inventory.view_audit'),
  validateBody(runReconciliationBodySchema),
  controller.runValuationReconciliation,
)

router.get(
  '/cost-variances',
  requireAnyPermission(...viewPerms),
  validateQuery(listVariancesQuerySchema),
  controller.listCostVariances,
)

router.get(
  '/moving-average/history',
  requireAnyPermission(...viewPerms),
  validateQuery(listMovingAverageHistoryQuerySchema),
  controller.listMovingAverageHistory,
)

router.get(
  '/method-change/preview',
  requireAnyPermission(...viewPerms),
  validateQuery(methodChangePreviewQuerySchema),
  controller.previewMethodChange,
)

router.post(
  '/standard-costs',
  requirePermission('inventory.setup.manage'),
  validateBody(upsertStandardCostBodySchema),
  controller.postStandardCostVersion,
)

router.post(
  '/method-change',
  requirePermission('inventory.setup.manage'),
  validateBody(methodChangeBodySchema),
  controller.postMethodChange,
)

router.get(
  '/effective-method',
  requireAnyPermission(...viewPerms),
  validateQuery(effectiveMethodQuerySchema),
  controller.getEffectiveMethod,
)

export default router
