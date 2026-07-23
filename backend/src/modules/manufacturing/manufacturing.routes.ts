import { Router } from 'express'
import workCentreRoutes from './work-centres/work-centre.routes.js'
import machineRoutes from './machines/machine.routes.js'
import bomRoutes from './boms/bom.routes.js'
import bomVersionRoutes from './boms/bom-version.routes.js'
import bomLineRoutes from './boms/bom-line.routes.js'
import routingRoutes from './routings/routing.routes.js'
import routingVersionRoutes from './routings/routing-version.routes.js'
import stageGroupRoutes from './routings/stage-group.routes.js'
import operationRoutes from './routings/operation.routes.js'
import dependencyRoutes from './routings/dependency.routes.js'
import profileRoutes from './profiles/profile.routes.js'
import warehouseMappingRoutes from './warehouse-mappings/warehouse-mapping.routes.js'
import demandRoutes, { soConversionRouter } from './demands/demand.routes.js'
import workOrderRoutes from './work-orders/work-order.routes.js'
import { todayRouter, controlRoomRouter } from './work-orders/dashboard.routes.js'
import assignmentRoutes from './assignments/assignment.routes.js'
import myWorkRoutes from './assignments/my-work.routes.js'
import kioskRoutes from './kiosk/kiosk.routes.js'
import dailyProductionRoutes from './daily-production/daily-production.routes.js'
import issueRoutes from './issues/issue.routes.js'
import jobWorkRoutes from './job-work/job-work.routes.js'
import runtimeChangeRoutes from './runtime-changes/runtime-change.routes.js'
import correctionRoutes from './corrections/correction.routes.js'
import planRoutes from './plans/plan.routes.js'
import accountingRoutes from './accounting/manufacturing-accounting.routes.js'
import costingRoutes from './costing/costing.routes.js'
import costMasterRoutes from './cost-masters/cost-master.routes.js'
import storeWorkbenchRoutes from './store-workbench/store-workbench.routes.js'
import { fgReceiptByIdRouter } from './fg-receipts/fg-receipt.routes.js'
import shopfloorRoutes from '../ops-reports/shopfloor/shopfloor.routes.js'
import traceabilityRoutes from '../ops-reports/traceability/traceability.routes.js'
import manufacturingSettingsRoutes from './settings/manufacturing-settings.routes.js'
import { authenticate } from '../../middleware/auth.middleware.js'
import { requireModule } from '../../middleware/require-module.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateParams } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema } from '../../utils/pagination.js'

const router = Router({ mergeParams: true })

/** Phase 10 proof gate — fail-open when no TenantModuleFlag row exists. */
router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
  requireModule('manufacturing'),
)

router.use('/work-centres', workCentreRoutes)
router.use('/machines', machineRoutes)
router.use('/boms', bomRoutes)
router.use('/bom-versions', bomVersionRoutes)
router.use('/bom-lines', bomLineRoutes)
router.use('/routings', routingRoutes)
router.use('/routing-versions', routingVersionRoutes)
router.use('/stages', stageGroupRoutes)
router.use('/operations', operationRoutes)
router.use('/dependencies', dependencyRoutes)
router.use('/profiles', profileRoutes)
router.use('/warehouse-mappings', warehouseMappingRoutes)
router.use('/settings', manufacturingSettingsRoutes)
// Phase 7E — costing policies, work-order cost and accounting productionisation.
router.use('/', costingRoutes)
router.use('/', costMasterRoutes)

// Phase 2A — Production Demands + Work Orders
router.use('/demands', demandRoutes)
router.use('/demand-sources', soConversionRouter)
router.use('/work-orders', workOrderRoutes)
// Phase 5A — Runtime changes (nested under a work order; falls through workOrderRoutes above)
router.use('/work-orders/:workOrderId/runtime-changes', runtimeChangeRoutes)
router.use('/today', todayRouter)
router.use('/control-room', controlRoomRouter)

// Phase 2B — Assignments, daily production, issues, my work
router.use('/assignments', assignmentRoutes)
router.use('/my-work', myWorkRoutes)
router.use('/kiosk', kioskRoutes)
router.use('/daily-production', dailyProductionRoutes)
router.use('/issues', issueRoutes)
router.use('/job-work', jobWorkRoutes)
router.use('/corrections', correctionRoutes)

// Phase 6A — Production Planning workbench
router.use('/plans', planRoutes)

// Phase 6B — Costing / manufacturing GL events (flag-gated)
router.use('/accounting', accountingRoutes)

// Phase 7A4/7A5 — FG receipt by id + store workbench
router.use(
  '/fg-receipts',
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
  fgReceiptByIdRouter,
)
router.use('/store-workbench', storeWorkbenchRoutes)

// Phase 7D — reporting foundation: live shopfloor board + cross-module traceability search/lineage
router.use('/shopfloor', shopfloorRoutes)
router.use('/traceability', traceabilityRoutes)

export default router
