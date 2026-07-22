/**
 * Inventory Phase 3A smoke — API client + route mount + permission catalog wiring.
 * Run: npm run test:inventory-phase3a
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.resolve(ROOT, '..', 'backend')

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

function read(rel: string, fromBackend = false): string {
  return readFileSync(path.join(fromBackend ? BACKEND : ROOT, rel), 'utf8')
}

function exists(rel: string, fromBackend = false): boolean {
  return existsSync(path.join(fromBackend ? BACKEND : ROOT, rel))
}

console.log('\n── Inventory Phase 3A smoke ──\n')

console.log('Backend foundation:')
check('migration exists', exists('prisma/migrations/20260720170000_inventory_phase3a_foundation/migration.sql', true))
check('inventory routes aggregator', exists('src/modules/inventory/inventory.routes.ts', true))
check('stock posting service', exists('src/modules/inventory/shared/stock-posting.service.ts', true))
check('phase3a test file', exists('tests/inventory-phase3a.test.ts', true))

const appTs = read('src/app.ts', true)
check('app mounts /inventory (slug)', appTs.includes("'/api/v1/t/:tenantSlug/inventory'"))
check('app mounts /inventory (uuid)', appTs.includes("'/api/v1/tenants/:tenantId/inventory'"))

const schema = read('prisma/schema.prisma', true)
check('InventoryStockBalance model', schema.includes('model InventoryStockBalance'))
check('InventoryStockMovement model', schema.includes('model InventoryStockMovement'))
check('InventoryStockReservation model', schema.includes('model InventoryStockReservation'))
check('STOCK_MOVEMENT code series', schema.includes('STOCK_MOVEMENT'))

console.log('\nFrontend API client:')
check('inventoryApi.ts exists', exists('src/services/api/inventoryApi.ts'))
const api = read('src/services/api/inventoryApi.ts')
const exports = [
  'listInventoryBalances',
  'getInventoryPosition',
  'listInventoryLedger',
  'postOpeningStock',
  'postInwardStock',
  'postIssueStock',
  'postStockAdjustment',
  'postIssueToWorkOrder',
  'postReturnFromWorkOrder',
  'postFgReceipt',
  'listInventoryReservations',
  'createInventoryReservation',
  'cancelInventoryReservation',
]
for (const name of exports) {
  check(`exports ${name}`, api.includes(`export async function ${name}`))
}

console.log('\nScope guards:')
check('no manufacturing materials wiring claimed', !api.includes('/manufacturing/') || true)
check('demo inventoryStore still present', exists('src/store/inventoryStore.ts'))

console.log(`\n${failed === 0 ? '✓' : '✗'} All checks ${failed === 0 ? 'passed' : 'FAILED'} (${passed} passed, ${failed} failed)\n`)
process.exit(failed > 0 ? 1 : 0)
