/**
 * Manufacturing Phase 1 smoke tests (dashboard, BOM, production plan).
 * Run: npm run test:manufacturing-module
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n── Manufacturing module smoke ──\n')

const routesPath = path.join(ROOT, 'src/routes/manufacturingRoutes.tsx')
const routesSrc = existsSync(routesPath) ? readFileSync(routesPath, 'utf8') : ''
check('manufacturingRoutes exists', existsSync(routesPath))
check('Dashboard route', routesSrc.includes('ManufacturingDashboardPage'))
check('BOM register route', routesSrc.includes('BomRegisterPage'))
check('BOM form route', routesSrc.includes('BomFormPage'))
check('BOM detail route', routesSrc.includes('BomDetailPage'))
check('Production plan route', routesSrc.includes('ProductionPlanPage'))
check('Work orders placeholder', routesSrc.includes('manufacturing/work-orders'))
check('Job work placeholder', routesSrc.includes('manufacturing/job-work'))

const indexSrc = readFileSync(path.join(ROOT, 'src/routes/index.tsx'), 'utf8')
check('index registers manufacturingRouteChildren', indexSrc.includes('...manufacturingRouteChildren'))

const {
  __resetManufacturingDemoState,
  getBoms,
  getBomById,
  createBom,
  duplicateBom,
  createBomVersion,
  activateBom,
  getBomCostPreview,
  getManufacturingDashboard,
  getProductionPlan,
  createWorkOrderDraftFromPlanDemo,
  createSelectedWorkOrdersDemo,
  checkPlannedMaterialAvailability,
} = await import('../src/services/manufacturing/manufacturingService')

__resetManufacturingDemoState()

const dashboard = await getManufacturingDashboard()
check('getManufacturingDashboard returns KPIs', dashboard.kpis.length > 0, String(dashboard.kpis.length))

const boms = await getBoms()
check('getBoms returns seed rows', boms.length > 0, String(boms.length))

const first = boms[0]
const byId = first ? await getBomById(first.id) : null
check('getBomById resolves', Boolean(byId))

if (first) {
  const cost = await getBomCostPreview(first.id)
  check('getBomCostPreview returns totals', cost !== null && cost.totalEstimatedCost >= 0)
}

const createResult = await createBom({
  finishedItemId: 'item-fg-demo',
  finishedItemCode: 'FG-DEMO-01',
  finishedItemName: 'Demo Finished Item',
  itemCategory: 'Finished Goods',
  productionQuantity: 1,
  baseUom: 'NOS',
  productionMethod: 'in_house',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  defaultMaterialWarehouseId: 'wh-rm',
  defaultMaterialWarehouseName: 'RM Stores',
  defaultFgWarehouseId: 'wh-fg',
  defaultFgWarehouseName: 'FG Stores',
  qualityRequired: true,
  batchRequired: false,
  serialRequired: false,
  lines: [
    {
      componentItemId: 'item-rm-beam',
      componentItemCode: 'RM-BEAM-6M',
      componentItemName: 'Axle Beam 6M',
      requiredQuantity: 2,
      uom: 'NOS',
      warehouseId: 'wh-rm',
      warehouseName: 'RM Stores',
      scrapPercent: 0,
      availableStock: 10,
      estimatedCost: 36000,
      supplyMethod: 'inventory',
    },
  ],
})
check('createBom succeeds', createResult.ok === true)

if (createResult.ok) {
  const dup = await duplicateBom(createResult.bom.id)
  check('duplicateBom succeeds', dup.ok === true)

  const ver = await createBomVersion(createResult.bom.id)
  check('createBomVersion succeeds', ver.ok === true)

  const act = await activateBom(createResult.bom.id)
  check('activateBom succeeds', act.ok === true)
}

const plan = await getProductionPlan()
check('getProductionPlan returns lines', plan.length > 0, String(plan.length))

const planLine = plan.find((p) => p.requiredProductionQuantity > 0) ?? plan[0]
if (planLine) {
  const mat = await checkPlannedMaterialAvailability([planLine.id])
  check('checkPlannedMaterialAvailability returns rows', Array.isArray(mat) && mat.length > 0)

  const wo = await createWorkOrderDraftFromPlanDemo(planLine.id)
  check('createWorkOrderDraftFromPlanDemo', wo.ok === true, wo.ok ? wo.workOrderNo : wo.error)
}

__resetManufacturingDemoState()
const planForBulk = await getProductionPlan()
const bulkIds = planForBulk.filter((p) => p.requiredProductionQuantity > 0).slice(0, 2).map((p) => p.id)
if (bulkIds.length > 0) {
  const bulk = await createSelectedWorkOrdersDemo(bulkIds)
  check('createSelectedWorkOrdersDemo', bulk.ok === true, bulk.ok ? String(bulk.created.length) : bulk.error)
}

const { MANUFACTURING_PERMISSIONS, canManufacturingPermission } = await import(
  '../src/utils/permissions/manufacturing'
)
check('manufacturing.view defined', MANUFACTURING_PERMISSIONS.includes('manufacturing.view'))
check('production_head can create BOM', canManufacturingPermission('manufacturing.bom.create', 'production_head'))
check('shop_floor cannot view cost', !canManufacturingPermission('manufacturing.bom.view_cost', 'shop_floor'))

console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
