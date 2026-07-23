/**
 * Guard: API-mode manufacturing accounting routes must not call the seed service.
 * Run: npx tsx scripts/verify-mfg-inventory-accounting.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`)
    failed += 1
  } else {
    console.log(`OK: ${msg}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

const routes = read('src/routes/accountingRoutes.tsx')
assert(
  routes.includes('ManufacturingAccountingApiGate'),
  'accountingRoutes wraps manufacturing accounting with ManufacturingAccountingApiGate',
)

const gate = read('src/components/accounting/manufacturingAccounting/ManufacturingAccountingApiGate.tsx')
assert(gate.includes('ManufacturingAccountingWorkspacePage'), 'ApiGate renders live workspace in API mode')
assert(gate.includes('isApiMode()'), 'ApiGate branches on isApiMode')

const workspace = read('src/modules/accounting/manufacturing/ManufacturingAccountingWorkspacePage.tsx')
assert(
  !workspace.includes('manufacturingAccountingService'),
  'live workspace does not import seed manufacturingAccountingService',
)
assert(workspace.includes('getAccountingWorkspaceSummary'), 'workspace loads live summary API')
assert(workspace.includes('listCostingPolicies'), 'workspace includes costing policies tab')

const invRoutes = read('src/routes/inventoryRoutes.tsx')
assert(invRoutes.includes('inventory/accounting'), 'inventory routes include /inventory/accounting')
assert(invRoutes.includes('InventoryAccountingEventsPage'), 'InventoryAccountingEventsPage mounted')

const invPage = read('src/modules/inventory/accounting/InventoryAccountingEventsPage.tsx')
assert(invPage.includes('fetchInventoryAccountingEvents'), 'inventory accounting page calls live API')
assert(invPage.includes('isApiMode'), 'inventory accounting page is dual-mode')

const pcService = read('src/services/accounting/periodCloseService.ts')
assert(pcService.includes('getAccountingWorkspaceSummary'), 'period close mfg summary uses live workspace')
assert(pcService.includes('fetchInventoryAccountingEvents'), 'period close inventory summary uses inv events')

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nAll mfg/inventory accounting FE guards passed')
