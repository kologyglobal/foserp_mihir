/**
 * Purchase mobile Phase C — structural checks (no network).
 * PR editor · RFQ · invoices · returns · QI decide · offline GRN queue
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canCompletePurchaseQi,
  canCreatePurchaseRequisition,
  canEditPrDocument,
  canViewInvoice,
  canViewReturn,
  canViewRfq,
  isQiActionable,
} from '../src/features/purchase/phaseCApi.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel: string) => join(root, rel)

const must = [
  'app/(app)/purchase/requisitions/edit.tsx',
  'app/(app)/purchase/rfq/index.tsx',
  'app/(app)/purchase/rfq/[id].tsx',
  'app/(app)/purchase/invoices/index.tsx',
  'app/(app)/purchase/invoices/[id].tsx',
  'app/(app)/purchase/returns/index.tsx',
  'app/(app)/purchase/returns/[id].tsx',
  'app/(app)/purchase/returns/create.tsx',
  'app/(app)/purchase/quality-inspections/[id].tsx',
  'src/features/purchase/phaseCApi.ts',
  'src/features/purchase/offlineGrnQueue.ts',
]
for (const f of must) {
  assert.ok(existsSync(src(f)), `missing ${f}`)
  const body = readFileSync(src(f), 'utf8')
  assert.ok(!body.includes('ComingSoonScreen'), `${f} still ComingSoon`)
}

const prEdit = readFileSync(src('app/(app)/purchase/requisitions/edit.tsx'), 'utf8')
assert.match(prEdit, /createPurchaseRequisition|updatePurchaseRequisition/)
assert.match(prEdit, /ScanField/)
assert.match(prEdit, /listMasterItems/)

const qiDecide = readFileSync(src('app/(app)/purchase/quality-inspections/[id].tsx'), 'utf8')
assert.match(qiDecide, /acceptPurchaseQualityInspection/)
assert.match(qiDecide, /rejectPurchaseQualityInspection/)
assert.match(qiDecide, /purchase\.qi/)

const offline = readFileSync(src('src/features/purchase/offlineGrnQueue.ts'), 'utf8')
assert.match(offline, /enqueueOfflineGrn/)
assert.match(offline, /flushOfflineGrnQueue/)
assert.match(offline, /NetInfo|isNetworkOnline/)

const receive = readFileSync(src('app/(app)/purchase/grn/receive.tsx'), 'utf8')
assert.match(receive, /enqueueOfflineGrn/)
assert.match(receive, /flushOfflineGrnQueue/)

const catalog = readFileSync(src('src/auth/navigationCatalog.ts'), 'utf8')
assert.match(catalog, /purchase\/rfq/)
assert.match(catalog, /purchase\/invoices/)
assert.match(catalog, /purchase\/returns/)
assert.match(catalog, /purchase\.rfq\.view/)
assert.match(catalog, /purchase\.invoice\.view/)
assert.match(catalog, /purchase\.return\.view/)

assert.equal(canCreatePurchaseRequisition(['purchase.pr.create']), true)
assert.equal(canViewRfq(['purchase.rfq.view']), true)
assert.equal(canViewInvoice(['purchase.invoice.view']), true)
assert.equal(canViewReturn(['purchase.return.view']), true)
assert.equal(canCompletePurchaseQi(['purchase.qi.complete']), true)
assert.equal(canEditPrDocument('DRAFT'), true)
assert.equal(canEditPrDocument('APPROVED'), false)
assert.equal(isQiActionable('PENDING'), true)
assert.equal(isQiActionable('ACCEPTED'), false)

console.log('verify-purchase-phase-c: all assertions passed')
