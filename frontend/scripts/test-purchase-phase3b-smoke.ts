/**
 * Purchase Phase 3B smoke — PR API client + backend mount + migration.
 * Run: npm run test:purchase-phase3b
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.resolve(ROOT, '..', 'backend')

let passed = 0
let failed = 0

function check(label: string, ok: boolean) {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

function read(rel: string, fromBackend = false) {
  return readFileSync(path.join(fromBackend ? BACKEND : ROOT, rel), 'utf8')
}

function exists(rel: string, fromBackend = false) {
  return existsSync(path.join(fromBackend ? BACKEND : ROOT, rel))
}

console.log('\n── Purchase Phase 3B smoke ──\n')

console.log('Backend:')
check('migration exists', exists('prisma/migrations/20260720250000_purchase_phase3b_requisition/migration.sql', true))
check('purchase routes', exists('src/modules/purchase/purchase.routes.ts', true))
check('requisition service', exists('src/modules/purchase/requisitions/requisition.service.ts', true))
check('phase3b tests', exists('tests/purchase-phase3b.test.ts', true))

const app = read('src/app.ts', true)
check('app mounts purchase (slug)', app.includes("'/api/v1/t/:tenantSlug/purchase'"))
check('app mounts purchase (uuid)', app.includes("'/api/v1/tenants/:tenantId/purchase'"))

const schema = read('prisma/schema.prisma', true)
check('PurchaseRequisition model', schema.includes('model PurchaseRequisition'))
check('PurchaseRequisitionLine model', schema.includes('model PurchaseRequisitionLine'))
check('PURCHASE_REQUISITION series', schema.includes('PURCHASE_REQUISITION'))
check('no PurchaseOrder model in 3B', !schema.includes('model PurchaseOrder'))

const perms = read('src/constants/permissions.ts', true)
check('purchase.requisition.cancel permission', perms.includes("'purchase.requisition.cancel'"))

console.log('\nFrontend API:')
check('purchaseApi.ts exists', exists('src/services/api/purchaseApi.ts'))
const api = read('src/services/api/purchaseApi.ts')
for (const name of [
  'listPurchaseRequisitions',
  'getPurchaseRequisition',
  'createPurchaseRequisition',
  'submitPurchaseRequisition',
  'approvePurchaseRequisition',
  'rejectPurchaseRequisition',
  'cancelPurchaseRequisition',
  'createPrFromProductionShortage',
  'listPurchaseRequisitionsByProductionOrder',
]) {
  check(`exports ${name}`, api.includes(`export async function ${name}`))
}

check('demo purchaseStore preserved', exists('src/store/purchaseStore.ts'))

console.log(`\n${failed === 0 ? '✓' : '✗'} (${passed} passed, ${failed} failed)\n`)
process.exit(failed > 0 ? 1 : 0)
