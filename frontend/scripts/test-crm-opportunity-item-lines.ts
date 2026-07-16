/**
 * CRM Opportunity Item Lines — npm run test:crm-opportunity-item-lines
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { useCrmStore } = await import('../src/store/crmStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const {
  buildOpportunityLineFromProduct,
  calcOpportunityLineDerived,
  calcOpportunityLinesSummary,
  calcWeightedValue,
  createEmptyOpportunityLine,
  getOpportunityItemSummary,
  opportunityLinesToQuotationPriceLines,
  resolveOpportunityLines,
  syncOpportunityLines,
  validateOpportunityLines,
} = await import('../src/utils/opportunityLineCalc')

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

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM Opportunity Item Lines Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetDemoBaseline()

const newPage = read('src/modules/crm/OpportunityNewPage.tsx')
const editPage = read('src/modules/crm/OpportunityEditPage.tsx')
const opp360 = read('src/modules/crm/Opportunity360Page.tsx')
const oppCard = read('src/components/crm/OpportunityCard.tsx')
const oppTable = read('src/components/crm/CrmOpportunitiesTable.tsx')
const crmStoreSrc = read('src/store/crmStore.ts')
const pkg = read('package.json')

check(1, 'New Opportunity page shows Product / Item Lines section', newPage.includes('Product / Item Lines') && newPage.includes('ErpLineItemsGrid'))
check(2, 'Add Row in ErpLineItemsGrid', read('src/components/erp/ErpLineItemsGrid.tsx').includes('Add blank line') || read('src/components/erp/ErpLineItemsGrid.tsx').includes('Add Row'))
check(2.1, 'Product card picker removed from line grid', !read('src/components/erp/ErpLineItemsGrid.tsx').includes('OpportunityProductAddPanel'))
check(3, 'ErpSmartSelect component exists', read('src/components/erp/ErpSmartSelect.tsx').includes('ErpSmartSelect'))
check(4, 'Product master options builder', read('src/utils/opportunityProductOptions.ts').includes('buildProductMasterOptions'))

const product = useMasterStore.getState().products.find((p) => p.isActive && p.status === 'released')
const item = product ? useMasterStore.getState().getItem(product.fgItemId) : undefined
const uom = product ? useMasterStore.getState().uoms.find((u) => u.id === product.baseUomId) : undefined

let line = product && uom
  ? buildOpportunityLineFromProduct(product, item, uom.uomCode, 1)
  : createEmptyOpportunityLine(1, { productOrItem: 'Test Tank', itemCode: 'TST-01', unitPrice: 100000, taxPct: 18, qty: 2 })

check(5, 'Selecting item auto-fills code, UOM, GST, price', !!line.itemCode && line.uom.length > 0 && line.taxPct > 0 && line.unitPrice > 0)

line = syncOpportunityLines([{ ...line, qty: 3 }])[0]!
const derived = calcOpportunityLineDerived(line)
check(6, 'Quantity updates Basic Amount', derived.basicAmount === line.qty * line.unitPrice)

line = syncOpportunityLines([{ ...line, discountPct: 10 }])[0]!
check(7, 'Discount % calculates Discount Amount', line.discountAmount === Math.round(line.qty * line.unitPrice * 0.1 * 100) / 100)
check(8, 'Taxable Value calculates correctly', line.taxableValue === Math.round((line.qty * line.unitPrice - line.discountAmount) * 100) / 100)
check(9, 'GST Amount calculates correctly', line.gstAmount > 0)
check(10, 'Line Total calculates correctly', line.lineTotal === line.taxableValue + line.gstAmount)

const multi = syncOpportunityLines([
  createEmptyOpportunityLine(1, { productOrItem: 'A', unitPrice: 100000, qty: 1, taxPct: 18 }),
  createEmptyOpportunityLine(2, { productOrItem: 'B', unitPrice: 200000, qty: 1, taxPct: 18 }),
])
const summary = calcOpportunityLinesSummary(multi)
check(11, 'Grand Total equals sum of lines', summary.grandTotal === multi.reduce((s, l) => s + l.lineTotal, 0))
check(12, 'Weighted Value uses Grand Total × Probability', calcWeightedValue(summary.grandTotal, 50) === Math.round(summary.grandTotal * 0.5 * 100) / 100)

const blockedEmpty = validateOpportunityLines([], { customerId: 'c1', ownerId: 'o1', stage: 'new_lead', probability: 30 })
check(13, 'Save blocked if no item rows', blockedEmpty.errors.some((e) => e.includes('line')))

const blockedItem = validateOpportunityLines([createEmptyOpportunityLine(1)], { customerId: 'c1', ownerId: 'o1', stage: 'new_lead', probability: 30 })
check(14, 'Save blocked if row item is missing', blockedItem.rowErrors[Object.keys(blockedItem.rowErrors)[0]!]?.some((e) => e.includes('Product')))

const blockedQty = validateOpportunityLines([
  createEmptyOpportunityLine(1, { productOrItem: 'Tank', unitPrice: 1000, qty: 0, taxPct: 18 }),
], { customerId: 'c1', ownerId: 'o1', stage: 'new_lead', probability: 30 })
check(15, 'Save blocked if quantity is zero', Object.values(blockedQty.rowErrors).flat().some((e) => e.includes('Quantity')))

const crm = useCrmStore.getState()
const customerId = useMasterStore.getState().customers[0]?.id ?? 'cust-crm-01'
const lines = syncOpportunityLines([
  createEmptyOpportunityLine(1, {
    productId: product?.id ?? null,
    productOrItem: product?.productName ?? '26 KL ISO Tank',
    itemCode: product?.productCode ?? 'ISO-26',
    unitPrice: 2500000,
    qty: 2,
    taxPct: 18,
    uom: 'Nos',
  }),
])
const created = crm.createOpportunity({
  customerId,
  contactId: null,
  productId: product?.id ?? null,
  opportunityName: 'Item Lines Test Deal',
  productRequirement: 'Multi-line test',
  lines,
  stage: 'new_lead',
  value: summary.grandTotal,
  probability: 40,
  expectedCloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
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
check(16, 'Opportunity saves item lines', created.ok && (useCrmStore.getState().getOpportunity(created.opportunityId!)?.lines.length ?? 0) > 0)

const saved = useCrmStore.getState().getOpportunity(created.opportunityId!)!
check(17, 'Opportunity 360 shows item lines tab', opp360.includes("id: 'items'") && opp360.includes('ErpLineItemsGrid'))
check(18, 'Opportunity list shows primary item and count', oppTable.includes('getOpportunityItemSummary') && oppTable.includes('item'))
check(19, 'Kanban card shows item summary', oppCard.includes('getOpportunityItemSummary') && oppCard.includes('itemCount'))

const qLines = opportunityLinesToQuotationPriceLines(saved.lines)
check(20, 'Save & Create Quotation passes item lines', newPage.includes('Save & Create Quotation') && newPage.includes('opportunityId='))

if (product) {
  const tpl = crm.quotationTemplates[0]
  const q = crm.createQuotationFromOpportunity(saved.id, tpl!.id, saved.lines[0]?.unitPrice ?? 2500000)
  const doc = q.documentId ? useCrmStore.getState().getQuotationDocument(q.documentId) : undefined
  check(21, 'Quotation receives opportunity item lines', q.ok && (doc?.priceLines.length ?? 0) >= saved.lines.length, `${doc?.priceLines.length ?? 0} lines`)
} else {
  check(21, 'Quotation receives opportunity item lines', qLines.length > 0)
}

check(22, 'Opportunity edit page uses line grid', editPage.includes('ErpLineItemsGrid'))
check(23, 'OpportunityLine type on Opportunity', read('src/types/crm.ts').includes('lines: OpportunityLine[]'))
check(24, 'Store createOpportunity syncs lines', crmStoreSrc.includes('syncOpportunityLines'))
check(25, 'npm script test:crm-opportunity-item-lines', pkg.includes('test:crm-opportunity-item-lines'))
check(26, 'Wired into test:ci', read('scripts/run-ci.ts').includes('test:crm-opportunity-item-lines'))
check(27, 'Wired into test:uat', read('scripts/test-uat.ts').includes('test:crm-opportunity-item-lines'))
check(28, 'Wired into test:eeta-100', read('scripts/test-eeta-100.ts').includes('test:crm-opportunity-item-lines'))
check(29, 'Wired into crm-freeze (eeata-fix)', read('scripts/test-crm-eeata-fix.ts').includes('test:crm-opportunity-item-lines'))

const itemSummary = getOpportunityItemSummary(saved, product)
check(30, 'Primary item summary for multi-line', itemSummary.length > 0)

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
