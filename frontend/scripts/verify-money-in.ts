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
  check('Error map has receipt-allocations-must-be-reversed', Boolean(MONEY_IN_ERROR_MESSAGES.CUSTOMER_RECEIPT_ALLOCATIONS_MUST_BE_REVERSED))
  check('Error map has credit-note reversal not allowed', Boolean(MONEY_IN_ERROR_MESSAGES.CUSTOMER_CREDIT_NOTE_REVERSAL_NOT_ALLOWED))
  check('Error map has allocation batch not reversible', Boolean(MONEY_IN_ERROR_MESSAGES.RECEIPT_ALLOCATION_BATCH_NOT_REVERSIBLE))

  // Permissions module (static source checks — avoids tsx @/ alias chain)
  const permSrc = read('src/utils/permissions/moneyIn.ts')
  check('Permission finance.ar.view', permSrc.includes("'finance.ar.view'"))
  check('Permission finance.ar.invoice.post', permSrc.includes("'finance.ar.invoice.post'"))
  check('Permission finance.ar.credit_note.view', permSrc.includes("'finance.ar.credit_note.view'"))
  check('Permission finance.ar.credit_note.post', permSrc.includes("'finance.ar.credit_note.post'"))
  check('Permission finance.ar.allocation.create', permSrc.includes("'finance.ar.allocation.create'"))
  check('Permission finance.ar.receipt.view', permSrc.includes("'finance.ar.receipt.view'"))
  check('Permission finance.ar.receipt.create', permSrc.includes("'finance.ar.receipt.create'"))
  check('Permission finance.ar.receipt.edit', permSrc.includes("'finance.ar.receipt.edit'"))
  check('Permission finance.ar.receipt.post', permSrc.includes("'finance.ar.receipt.post'"))
  check('Permission finance.ar.receipt.cancel', permSrc.includes("'finance.ar.receipt.cancel'"))
  check('Permission finance.ar.allocation.reverse', permSrc.includes("'finance.ar.allocation.reverse'"))
  check('Permission finance.ar.receipt.reverse', permSrc.includes("'finance.ar.receipt.reverse'"))
  check('Permission finance.ar.credit_note.reverse', permSrc.includes("'finance.ar.credit_note.reverse'"))
  check('canAllocate exposed', permSrc.includes('canAllocate'))
  check('canCreateReceipt exposed', permSrc.includes('canCreateReceipt'))
  check('canPostReceipt exposed', permSrc.includes('canPostReceipt'))
  check('canReverseAllocation exposed', permSrc.includes('canReverseAllocation'))
  check('canReverseReceipt exposed', permSrc.includes('canReverseReceipt'))
  check('canReverseCreditNote exposed', permSrc.includes('canReverseCreditNote'))
  check('mergeAllowedAction helper', permSrc.includes('mergeAllowedAction'))
  check('useMoneyInPermissions hook', permSrc.includes('useMoneyInPermissions'))

  // Workspace tabs
  check('Eight workspace tabs', MONEY_IN_WORKSPACE_TABS.length === 8)
  check('Overview tab path', MONEY_IN_WORKSPACE_TABS[0].path === '/accounting/money-in')
  check('Receipts tab present', MONEY_IN_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-in/receipts'))
  check('Credit Notes tab present', MONEY_IN_WORKSPACE_TABS.some((t) => t.path === '/accounting/money-in/credit-notes'))
  check(
    'Receipts tab ordered after Invoices, before Credit Notes',
    MONEY_IN_WORKSPACE_TABS.findIndex((t) => t.path === '/accounting/money-in/invoices') <
      MONEY_IN_WORKSPACE_TABS.findIndex((t) => t.path === '/accounting/money-in/receipts') &&
      MONEY_IN_WORKSPACE_TABS.findIndex((t) => t.path === '/accounting/money-in/receipts') <
        MONEY_IN_WORKSPACE_TABS.findIndex((t) => t.path === '/accounting/money-in/credit-notes'),
  )

  // Route registration smoke
  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Money In overview route', routesSrc.includes("path: 'accounting/money-in'"))
  check('Money In invoices route', routesSrc.includes("path: 'accounting/money-in/invoices'"))
  check('Money In receipts route', routesSrc.includes("path: 'accounting/money-in/receipts'"))
  check('Money In receipts new route', routesSrc.includes("path: 'accounting/money-in/receipts/new'"))
  check('Money In receipts detail route', routesSrc.includes("path: 'accounting/money-in/receipts/:id'"))
  check('Money In receipts edit route', routesSrc.includes("path: 'accounting/money-in/receipts/:id/edit'"))
  check('Money In receipts allocate route', routesSrc.includes("path: 'accounting/money-in/receipts/:id/allocate'"))
  check('Money In credit notes route', routesSrc.includes("path: 'accounting/money-in/credit-notes'"))
  check('Money In credit notes new route', routesSrc.includes("path: 'accounting/money-in/credit-notes/new'"))
  check('Money In credit notes detail route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id'"))
  check('Money In credit notes edit route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id/edit'"))
  check('Money In credit notes allocate route', routesSrc.includes("path: 'accounting/money-in/credit-notes/:id/allocate'"))
  check(
    'Legacy demo receivables credit-notes route preserved',
    routesSrc.includes("path: 'accounting/receivables/credit-notes'"),
  )
  check(
    'Legacy demo receivables receipts route preserved',
    routesSrc.includes("path: 'accounting/receivables/receipts'"),
  )

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
        const cnBatchId = history[0]?.batchId
        if (cnBatchId) {
          const cnAllocRev = store.reverseCreditNoteAllocationDemo(postedNote.id, cnBatchId, 'smoke reverse')
          check('Reverse credit note allocation demo', cnAllocRev.batch.status === 'REVERSED')
        } else {
          check('Credit note allocation batch id present for reverse', false)
        }
        const cnDocRev = store.reverseCreditNoteDemo(postedNote.id, 'smoke reverse')
        check('Reverse credit note document demo', cnDocRev.creditNote.status === 'REVERSED')
      } catch (e) {
        check('Allocate/reverse credit note demo', false, e instanceof Error ? e.message : String(e))
      }
    } else {
      check('Outstanding invoice available for allocation smoke', false)
    }
  }

  // Customer receipts (Phase 3B6) demo store smoke
  store.seedReceiptsIfEmpty(DEMO_LEGAL_ENTITY_ID)
  const receipts = store.listReceipts({ legalEntityId: DEMO_LEGAL_ENTITY_ID })
  check('Receipt list seeded', receipts.length >= 2, `count=${receipts.length}`)

  const draftReceipt = receipts.find((r) => r.status === 'DRAFT')
  check('Seed has DRAFT receipt', Boolean(draftReceipt))

  const postedReceipt = receipts.find((r) => r.status === 'POSTED')
  check('Seed has POSTED receipt with unallocated balance', Boolean(postedReceipt) && Number(postedReceipt?.unallocatedAmount) > 0)

  const createdReceipt = store.createReceipt({
    legalEntityId: DEMO_LEGAL_ENTITY_ID,
    customerId: 'b2000001-0001-4001-8001-000000000001',
    sourceType: 'DIRECT',
    receiptDate: new Date().toISOString().slice(0, 10),
    postingDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'BANK_TRANSFER',
    bankCashAmount: '5000.00',
    bankCashAccountId: 'acc-bank',
  })
  check('Create draft receipt', createdReceipt.status === 'DRAFT', createdReceipt.draftReference ?? createdReceipt.id)
  const fetchedReceipt = store.getReceipt(createdReceipt.id)
  check('Get receipt round-trips', Boolean(fetchedReceipt) && fetchedReceipt?.allowedActions?.markReady === true)
  const readyReceipt = store.markReceiptReady(createdReceipt.id)
  check('Mark receipt ready', readyReceipt.status === 'READY_TO_POST')
  const postResult = store.postReceipt(createdReceipt.id)
  check('Post receipt', postResult.receipt.status === 'POSTED', postResult.posting.voucherNumber)
  const postReplay = store.postReceipt(createdReceipt.id)
  check('Idempotent receipt post replay', postReplay.idempotentReplay === true)

  if (postedReceipt) {
    const outstandingForReceipt = store.listOutstanding({ legalEntityId: DEMO_LEGAL_ENTITY_ID, customerId: postedReceipt.customerId })
    const target = outstandingForReceipt.items[0]
    if (target) {
      try {
        const allocated = store.allocateReceiptDemo(postedReceipt.id, {
          allocationDate: new Date().toISOString().slice(0, 10),
          allocations: [{ invoiceId: target.salesInvoiceId ?? '', invoiceOpenItemId: target.openItemId, amount: '1' }],
        })
        check('Allocate receipt demo', allocated.idempotentReplay === false, `invoices=${allocated.invoices.length}`)
        const history = store.listReceiptAllocationsDemo(postedReceipt.id)
        check('Receipt allocation history recorded', history.length >= 1)
        const rcptBatchId = history[0]?.batchId
        if (rcptBatchId) {
          const rcptAllocRev = store.reverseReceiptAllocationDemo(postedReceipt.id, rcptBatchId, 'smoke reverse')
          check('Reverse receipt allocation demo', rcptAllocRev.batch.status === 'REVERSED')
        } else {
          check('Receipt allocation batch id present for reverse', false)
        }
        const rcptDocRev = store.reverseReceiptDemo(postedReceipt.id, 'smoke reverse')
        check('Reverse receipt document demo', rcptDocRev.receipt.status === 'REVERSED')
      } catch (e) {
        check('Allocate/reverse receipt demo', false, e instanceof Error ? e.message : String(e))
      }
    } else {
      check('Outstanding invoice available for receipt allocation smoke', false)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
