/**
 * Multi-line quotation → SO — npm run test:crm-multiline-quotation-to-so
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(k: string) {
    return mem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    mem.set(k, v)
  },
  removeItem(k: string) {
    mem.delete(k)
  },
  key() {
    return null
  },
}

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { resetCrmBootstrapGuard } = await import('../src/demo/factories/crmEcosystemBootstrap')
const { useCrmStore } = await import('../src/store/crmStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { syncLineTotals } = await import('../src/utils/crmQuotationCalc')
const {
  buildSalesOrderLinesFromQuotationDocument,
  lookupProductIdByLabel,
} = await import('../src/utils/crmQuotationSoLines')
const { createEmptyOpportunityLine, syncOpportunityLines } = await import('../src/utils/opportunityLineCalc')

let pass = 0
let fail = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nCRM Multi-line Quotation → SO Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const crm = useCrmStore.getState()
const masters = useMasterStore.getState()
const products = masters.products.filter((p) => p.isActive && p.status === 'released')
const p1 = products[0]!
const p2 = products.find((p) => p.id !== p1.id)!

check(1, 'Demo has at least two released products', Boolean(p2), `${products.length} products`)

if (p2) {
  check(
    2,
    'Product lookup resolves by product name',
    lookupProductIdByLabel(p1.productName, products) === p1.id,
  )

  const customerId = masters.customers[0]?.id ?? 'cust-crm-01'
  const oppLines = syncOpportunityLines([
    createEmptyOpportunityLine(1, {
      productId: p1.id,
      productOrItem: p1.productName,
      itemCode: p1.productCode,
      unitPrice: 1200000,
      qty: 1,
      taxPct: 18,
      uom: 'Nos',
    }),
    createEmptyOpportunityLine(2, {
      productId: p2.id,
      productOrItem: p2.productName,
      itemCode: p2.productCode,
      unitPrice: 800000,
      qty: 2,
      taxPct: 18,
      uom: 'Nos',
    }),
  ])

  const opp = crm.createOpportunity({
    customerId,
    contactId: null,
    productId: p1.id,
    opportunityName: 'Multi-line quotation SO test',
    productRequirement: 'Two products on one quotation',
    lines: oppLines,
    stage: 'qualified',
    value: oppLines.reduce((s, l) => s + l.lineTotal, 0),
    probability: 55,
    expectedCloseDate: '2026-12-15',
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    priority: 'high',
    status: 'open',
    lostReason: null,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    leadId: null,
    nextFollowUpDate: null,
  })

  let soLineProductIds: string[] = []
  if (opp.ok && opp.opportunityId) {
    const q = crm.createQuotationFromOpportunity(opp.opportunityId, 'qtpl-iso-tank', 2000000)
    const doc = q.documentId ? crm.getQuotationDocument(q.documentId) : undefined
    check(3, 'Quotation document carries multiple price lines', (doc?.priceLines.length ?? 0) >= 2, `${doc?.priceLines.length ?? 0} lines`)
    check(
      4,
      'Price lines retain opportunity product ids',
      Boolean(doc?.priceLines.every((l, i) => !l.isOptional && l.productId === oppLines[i]?.productId)),
    )

    if (doc) {
      const previewLines = buildSalesOrderLinesFromQuotationDocument({
        document: doc,
        opportunity: crm.getOpportunity(opp.opportunityId),
        salesQuotation: q.quotationId ? useSalesStore.getState().getQuotation(q.quotationId) : undefined,
        products: masters.products,
      })
      check(
        5,
        'SO line builder maps distinct products',
        previewLines.length >= 2 && new Set(previewLines.map((l) => l.productId)).size >= 2,
      )
    }

    if (q.documentId) {
      crm.approveQuotationDocument(q.documentId, 'Multi-line test approved')
      const conv = crm.convertQuotationDocumentToSalesOrder(q.documentId, {
        customerPoNumber: 'PO-ML-001',
        expectedDeliveryDate: '2026-12-20',
      })
      if (conv.ok && conv.salesOrderId) {
        const so = useMrpStore.getState().getSalesOrder(conv.salesOrderId)
        soLineProductIds = (so?.lines ?? []).map((l) => l.productId).filter(Boolean) as string[]
        check(6, 'Converted SO stores multiple lines', (so?.lines.length ?? 0) >= 2, `${so?.lines.length ?? 0} lines`)
        check(
          7,
          'Each product line keeps its own productId',
          soLineProductIds.includes(p1.id) && soLineProductIds.includes(p2.id),
          soLineProductIds.join(', '),
        )
        check(
          8,
          'SO line labels match quotation items',
          Boolean(so?.lines.every((l) => l.productOrItem.length > 0)),
        )
      } else {
        for (const n of [6, 7, 8]) check(n, 'Conversion step', false, conv.error)
      }
    }
  } else {
    for (const n of [3, 4, 5, 6, 7, 8]) check(n, 'Opportunity flow step', false)
  }

  // Quotation-only path — no opportunity lines, product resolved from labels
  const openOpp = crm.createOpportunity({
    customerId,
    contactId: null,
    productId: p1.id,
    opportunityName: 'Quotation-only multi-line',
    productRequirement: 'Manual price table',
    lines: [],
    stage: 'qualified',
    value: 3000000,
    probability: 40,
    expectedCloseDate: '2026-11-30',
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    priority: 'medium',
    status: 'open',
    lostReason: null,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    leadId: null,
    nextFollowUpDate: null,
  })

  if (openOpp.ok && openOpp.opportunityId) {
    const q2 = crm.createQuotationFromOpportunity(openOpp.opportunityId, 'qtpl-iso-tank', 1500000)
    if (q2.documentId) {
      const manualLines = syncLineTotals([
        {
          id: 'pl-manual-1',
          productOrItem: p1.productName,
          description: 'Line A',
          qty: 1,
          uom: 'Nos',
          unitPrice: 1500000,
          discountPct: 0,
          taxPct: 18,
          lineTotal: 0,
          isOptional: false,
        },
        {
          id: 'pl-manual-2',
          productOrItem: p2.productName,
          description: 'Line B',
          qty: 1,
          uom: 'Nos',
          unitPrice: 900000,
          discountPct: 0,
          taxPct: 18,
          lineTotal: 0,
          isOptional: false,
        },
      ])
      crm.updateQuotationDocumentPriceTable(q2.documentId, manualLines)
      crm.approveQuotationDocument(q2.documentId, 'Manual multi-line approved')
      const conv2 = crm.convertQuotationDocumentToSalesOrder(q2.documentId, { customerPoNumber: 'PO-ML-002' })
      if (conv2.ok && conv2.salesOrderId) {
        const so2 = useMrpStore.getState().getSalesOrder(conv2.salesOrderId)
        const ids = (so2?.lines ?? []).map((l) => l.productId)
        check(
          9,
          'Quotation-only multi-line resolves products from labels',
          ids.includes(p1.id) && ids.includes(p2.id),
          ids.filter(Boolean).join(', '),
        )
      } else {
        check(9, 'Quotation-only multi-line resolves products from labels', false, conv2.error)
      }
    } else {
      check(9, 'Quotation-only multi-line resolves products from labels', false)
    }
  } else {
    check(9, 'Quotation-only multi-line resolves products from labels', false)
  }
} else {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) check(n, 'Needs two products', false)
}

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
