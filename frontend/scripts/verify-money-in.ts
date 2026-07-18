/**
 * Phase 3A6 Money In — bridge smoke, UI helpers, permissions, route paths.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Money In (Phase 3A6) verification')
  console.log('═══════════════════════════════════════\n')

  const {
    MONEY_IN_ERROR_MESSAGES,
    MONEY_IN_STATUS_LABELS,
    MONEY_IN_WORKSPACE_TABS,
    mapMoneyInError,
  } = await import('../src/modules/accounting/money-in/moneyInUi.ts')

  const { DEMO_LEGAL_ENTITY_ID } = await import('../src/store/financeSetupStore.ts')
  const { getReceivablesDemoState, seedReceivablesDemoIfEmpty } = await import('../src/store/receivablesDemoStore.ts')

  // UI helpers
  check('Status label DRAFT', MONEY_IN_STATUS_LABELS.DRAFT === 'Draft')
  check('Status label READY_TO_POST', MONEY_IN_STATUS_LABELS.READY_TO_POST === 'Ready to Post')
  check('Error map STALE_UPDATE', mapMoneyInError('STALE_UPDATE').includes('changed'))
  check('Error map unknown falls back', mapMoneyInError('CUSTOM_CODE', 'fallback') === 'fallback')
  check('Error registry has PERIOD_CLOSED', Boolean(MONEY_IN_ERROR_MESSAGES.PERIOD_CLOSED))

  // Permissions module (static source checks — avoids tsx @/ alias chain)
  const permSrc = read('src/utils/permissions/moneyIn.ts')
  check('Permission finance.ar.view', permSrc.includes("'finance.ar.view'"))
  check('Permission finance.ar.invoice.post', permSrc.includes("'finance.ar.invoice.post'"))
  check('mergeAllowedAction helper', permSrc.includes('mergeAllowedAction'))
  check('useMoneyInPermissions hook', permSrc.includes('useMoneyInPermissions'))

  // Workspace tabs
  check('Six workspace tabs', MONEY_IN_WORKSPACE_TABS.length === 6)
  check('Overview tab path', MONEY_IN_WORKSPACE_TABS[0].path === '/accounting/money-in')

  // Route registration smoke
  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Money In overview route', routesSrc.includes("path: 'accounting/money-in'"))
  check('Money In invoices route', routesSrc.includes("path: 'accounting/money-in/invoices'"))
  check('Legacy receivables redirects to Money In', routesSrc.includes('Navigate to="/accounting/money-in"'))

  // Demo store smoke
  seedReceivablesDemoIfEmpty(DEMO_LEGAL_ENTITY_ID)
  const store = getReceivablesDemoState()
  const overview = store.getOverview(DEMO_LEGAL_ENTITY_ID)
  check('Overview loads', overview.legalEntityId === DEMO_LEGAL_ENTITY_ID, `openItems=${overview.totals.openItemCount}`)

  const invoices = store.listInvoices({ legalEntityId: DEMO_LEGAL_ENTITY_ID })
  check('Invoice list seeded', invoices.length >= 4, `count=${invoices.length}`)

  const ready = invoices.find((i) => i.status === 'READY_TO_POST')
  if (ready) {
    try {
      const postResult = store.postInvoice(ready.id)
      check('Post ready invoice', postResult.invoice.status === 'POSTED', postResult.posting.voucherNumber)
      const replay = store.postInvoice(ready.id)
      check('Idempotent post replay', replay.idempotentReplay === true)
    } catch (e) {
      check('Post ready invoice', false, e instanceof Error ? e.message : String(e))
    }
  } else {
    check('Seed has READY_TO_POST invoice', false)
  }

  const created = store.createInvoice({
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    customerId: 'b2000001-0001-4001-8001-000000000001',
    invoiceDate: new Date().toISOString().slice(0, 10),
    postingDate: new Date().toISOString().slice(0, 10),
    taxTreatment: 'REGISTERED',
    lines: [{ lineNumber: 1, description: 'Test line', quantity: '1', unitPrice: '1000' }],
  })
  check('Create draft invoice', created.status === 'DRAFT', created.draftReference ?? created.id)
  const marked = store.markReady(created.id)
  check('Mark ready', marked.status === 'READY_TO_POST')

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
