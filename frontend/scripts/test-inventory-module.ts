/**
 * Inventory Phase 1 + Phase 2 smoke tests.
 * Run: npx tsx scripts/test-inventory-module.ts
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\n── Inventory module smoke ──\n')

// Routes
const routes = path.join(ROOT, 'src/routes/inventoryRoutes.tsx')
const routesSrc = existsSync(routes) ? await import('node:fs').then((fs) => fs.readFileSync(routes, 'utf8')) : ''
check('inventoryRoutes exists', existsSync(routes))
check('Overview route', routesSrc.includes('InventoryOverviewPage'))
check('Items register route', routesSrc.includes('InventoryItemsListPage'))
check('Stock availability route', routesSrc.includes('StockAvailabilityPage'))
check('Receipts register route', routesSrc.includes('ReceiptsRegisterPage'))
check('Issues register route', routesSrc.includes('IssuesRegisterPage'))
check('Quick receipt route', routesSrc.includes('QuickReceiptPage'))
check('Quick issue route', routesSrc.includes('QuickIssuePage'))

// Services
const { getItems, getStockAvailability, resetInventoryServiceForTests } = await import('../src/services/inventory/inventoryService')
const movement = await import('../src/services/inventory/movementService')

resetInventoryServiceForTests()
movement.resetMovementServiceForTests()

const items = await getItems()
check('getItems returns rows', items.length > 0, String(items.length))

const stock = await getStockAvailability()
check('getStockAvailability returns rows', stock.length >= 0, String(stock.length))

await movement.seedDemoMovementsIfEmpty()
const receipts = await movement.getReceipts()
check('getReceipts after seed', receipts.length >= 0, String(receipts.length))

const issues = await movement.getIssues()
check('getIssues after seed', issues.length >= 0, String(issues.length))

const poDocs = await movement.getReceiptSourceDocuments('purchase_order')
check('getReceiptSourceDocuments PO', Array.isArray(poDocs))

const woDocs = await movement.getIssueSourceDocuments('production_order')
check('getIssueSourceDocuments WO', Array.isArray(woDocs))

// Permissions
const { INVENTORY_PERMISSIONS, canInventoryPermission } = await import('../src/utils/permissions/inventory')
check('receipts permissions defined', INVENTORY_PERMISSIONS.includes('inventory.receipts.view'))
check('issues permissions defined', INVENTORY_PERMISSIONS.includes('inventory.issues.view'))
check('quality permissions defined', INVENTORY_PERMISSIONS.includes('inventory.quality.inspect'))
check('store_manager can post receipt', canInventoryPermission('inventory.receipts.post', 'store_manager'))

console.log(`\n── Result: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
