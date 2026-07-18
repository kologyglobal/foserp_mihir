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
  check('Permission finance.ar.credit_note.view', permSrc.includes("'finance.ar.credit_note.view'"))
  check('Permission finance.ar.credit_note.post', permSrc.includes("'finance.ar.credit_note.post'"))
  check('Permission finance.ar.allocation.create', permSrc.includes("'finance.ar.allocation.create'"))
  check('canAllocate exposed', permSrc.includes('canAllocate'))
  check('mergeAllowedAction helper', permSrc.includes('mergeAllowedAction'))
  check('useMoneyInPermissions hook', permSrc.includes('useMoneyInPermissions'))

  // Workspace tabs
  check('Seven workspace tabs', MONEY_IN_WORKSPACE_TABS.length === 7)
  check('Overview tab path', MONEY_IN_WORKSPACE_TABS[0].path === '/accounting/money-in')
  check('Credit Notes tab present', MONEY_IN_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-in/credit-notes'))

  // Route registration smoke
  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Money In overview route', routesSrc.includes("path: 'accounting/money-in'"))
  check('Money In invoices route', routesSrc.includes("path: 'accounting/money-in/invoices'"))
  check('Money In credit notes route', routesSrc.includes("path: 'accounting/money-in/credit-notes'"))
  check('Money In credit notes new route', routesSrc.includes("path: 'accounting/money-in/credit-notes/new'"))
  check('Money In credit notes detail route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id'"))
  check('Money In credit notes edit route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id/edit'"))
  check('Money In credit notes allocate route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id/allocate'"))
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

  // Credit notes (Phase 3C6) demo store smoke
  store.seedCreditNotesIfEmpty(DEMO_LEGAL_ENTITY_ID)
  const creditNotes = store.listCreditNotes({ legalEntityId: DEMO_LEGAL_ENTITY_ID })
  check('Credit note list seeded', creditNotes.length >= 2, `count=${creditNotes.length}`)

  const draftNote = creditNotes.find((n) => n.status === 'DRAFT')
  check('Seed has DRAFT credit note', Boolean(draftNote))

  const postedNote = creditNotes.find((n) => n.status === 'POSTED')
  check('Seed has POSTED credit note with unallocated balance', Boolean(postedNote) && Number(postedNote?.unallocatedAmount) > 0)

  const createdNote = store.createCreditNote({
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    purpose: 'SALES_RETURN',
    sourceType: 'DIRECT',
    customerId: 'b2000001-0001-4001-8001-000000000001',
    creditNoteDate: new Date().toISOString().slice(0, 10),
    postingDate: new Date().toISOString().slice(0, 10),
    lines: [{ lineNumber: 1, adjustmentMode: 'FULL_LINE', description: 'Test credit line', quantity: '1', unitRate: '1000' }],
  })
  check('Create draft credit note', createdNote.status === 'DRAFT', createdNote.draftReference ?? createdNote.id)
  const fetchedNote = store.getCreditNote(createdNote.id)
  check('Get credit note round-trips', Boolean(fetchedNote) && fetchedNote?.allowedActions?.markReady === true)
  const readyNote = store.markCreditNoteReady(createdNote.id)
  check('Mark credit note ready', readyNote.status === 'READY_TO_POST')

  if (postedNote) {
    const outstanding = store.listOutstanding({ legalEntityId: DEMO_LEGAL_ENTITY_ID, customerId: postedNote.customerId })
    const target = outstanding.items[0]
    if (target) {
      try {
        const allocated = store.allocateCreditNoteDemo(postedNote.id, {
          allocationDate: new Date().toISOString().slice(0, 10),
          allocations: [{ invoiceId: target.salesInvoiceId ?? '', invoiceOpenItemId: target.openItemId, amount: '1' }],
        })
        check('Allocate credit note demo', allocated.idempotentReplay === false, `invoices=${allocated.invoices.length}`)
        const history = store.listCreditNoteAllocationsDemo(postedNote.id)
        check('Allocation history recorded', history.length >= 1)
      } catch (e) {
        check('Allocate credit note demo', false, e instanceof Error ? e.message : String(e))
      }
    } else {
      check('Outstanding invoice available for allocation smoke', false)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
