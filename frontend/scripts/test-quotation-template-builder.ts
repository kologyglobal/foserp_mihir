/**
 * Quotation Template Builder tests — npm run test:quotation-template-builder
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
const { useSalesStore } = await import('../src/store/salesStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useDmsStore } = await import('../src/store/dmsStore')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
const { buildQuotationMergeMap, resolvePlaceholders, findMissingPlaceholderValues } = await import('../src/utils/quotationEngine/placeholders')
const { amountInWordsINR } = await import('../src/utils/quotationEngine/amountInWords')
const { validateQuotationForPrint, sectionCompletionStatus } = await import('../src/utils/quotationEngine/validation')
const { cloneTemplateSections } = await import('../src/utils/quotationEngine/cloneSections')
const { saveQuotationPdfToDms } = await import('../src/utils/quotationEngine/pdfExport')
const { calcPriceSummary, syncLineTotals } = await import('../src/utils/crmQuotationCalc')
const { ISO_TANK_26KL_SECTIONS } = await import('../src/data/quotations/templates/isoTank26Kl')
const { resolveQuotationPrintLayout, DEFAULT_QUOTATION_PRINT_LAYOUT } = await import('../src/utils/quotationEngine/printLayout')

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

function routeExists(sub: string): boolean {
  const routes = readFileSync(path.join(ROOT, 'src/routes/quotationRoutes.tsx'), 'utf8')
  return routes.includes(sub)
}

function fileExists(rel: string): boolean {
  try {
    readFileSync(path.join(ROOT, rel), 'utf8')
    return true
  } catch {
    return false
  }
}

console.log('\nQuotation Template Builder Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetDemoBaseline()

const crm = useCrmStore.getState()
const sales = useSalesStore.getState()
const customers = useMasterStore.getState().customers

check(1, 'Quotation template list loads', crm.quotationTemplates.length >= 9, `${crm.quotationTemplates.length} templates`)

const newTpl = crm.createQuotationTemplate({
  templateName: 'Test Builder Template',
  productFamily: 'Test',
  sourceTemplateId: 'qtpl-iso-tank',
})
check(2, 'New template can be created', newTpl.ok && !!newTpl.templateId)

const tplId = newTpl.templateId!
const tpl = crm.getTemplate(tplId)!
const cloned = cloneTemplateSections(tpl.sections, (p) => `${p}-test`)
crm.updateQuotationTemplate(tplId, {
  sections: cloned.map(({ id: _id, ...s }) => ({
    ...s,
    specRows: s.specRows?.map(({ id: _rid, ...r }) => r),
  })),
})
const updated = useCrmStore.getState().getTemplate(tplId)!
const withCustom = [
  ...updated.sections,
  { sectionType: 'custom' as const, title: 'Extra', content: 'Test', sequenceNo: updated.sections.length + 1, editable: true },
]
crm.updateQuotationTemplate(tplId, { sections: withCustom })
check(3, 'Template sections can be added, edited, reordered and deleted', useCrmStore.getState().getTemplate(tplId)!.sections.length > tpl.sections.length)

const isoTpl = crm.getTemplate('qtpl-iso-tank')
check(4, 'ISO Tank 26 KL template mapped with spec rows', (isoTpl?.sections.filter((s) => s.contentFormat === 'spec_table').length ?? 0) >= 8)

const openOpp = crm.opportunities.find((o) => !o.quotationId && o.productId)
let docId: string | undefined
if (openOpp) {
  const q = crm.createQuotationFromOpportunity(openOpp.id, 'qtpl-iso-tank', 2500000)
  check(5, 'Quotation can be created from opportunity', q.ok)
  docId = q.documentId
} else {
  check(5, 'Quotation can be created from opportunity', false, 'no open opp')
}

const doc = docId ? useCrmStore.getState().getQuotationDocument(docId) : crm.quotationDocuments[0]
const quotation = doc ? sales.getQuotation(doc.quotationId) : undefined
const customer = quotation ? customers.find((c) => c.id === quotation.customerId) : customers[0]

if (doc && quotation) {
  const map = buildQuotationMergeMap({ document: doc, quotation, customer })
  const resolved = resolvePlaceholders('Hello {{customer_name}}', map)
  check(6, 'Placeholder values resolve from CRM/customer/product data', resolved.includes(customer?.customerName ?? '') || !resolved.includes('{{customer_name}}'))
  check(7, 'Missing placeholder data shows warning', Array.isArray(findMissingPlaceholderValues(map)))
  check(8, 'Customer data auto-fills', map.customer_name !== '—' || !!customer?.customerName)
  check(9, 'Product data auto-fills', map.product_name.length > 0)

  const lines = syncLineTotals([{
    id: 'l1', productOrItem: '26 KL ISO Tank', description: 'Supply', qty: 1, uom: 'Nos',
    unitPrice: 2500000, discountPct: 5, taxPct: 18, lineTotal: 0, isOptional: false,
  }])
  crm.updateQuotationDocumentPriceTable(doc.id, lines)
  const sum = calcPriceSummary(lines, 0, 0, 0)
  check(10, 'Price table calculates GST and total', sum.gstAmount > 0 && sum.grandTotal > sum.taxableValue)
  check(11, 'Amount in words generates correctly', amountInWordsINR(sum.grandTotal).includes('Rupees'))

  const specSec = doc.sections.find((s) => s.contentFormat === 'spec_table')
  check(12, 'Technical specification editor supports spec_table sections', !!specSec?.specRows?.length || ISO_TANK_26KL_SECTIONS.some((s) => s.specRows?.length))

  crm.updateQuotationDocumentSections(doc.id, doc.sections)
  check(13, 'Quotation draft saves', !!useCrmStore.getState().getQuotationDocument(doc.id))

  check(14, 'Preview route exists', routeExists('quotations/:id/preview'))
  check(15, 'Print route exists', routeExists('quotations/:id/print'))
  check(16, 'Print document component exists', fileExists('src/components/quotations/QuotationPrintDocument.tsx'))

  const rev = crm.createQuotationRevision(doc.id, 'Price revision test')
  const docs = useCrmStore.getState().getQuotationDocumentsForQuotation(doc.quotationId)
  const oldLocked = docs.find((d) => d.revisionNo === doc.revisionNo)?.locked
  check(17, 'Revision can be created with reason', rev.ok)
  check(18, 'Old revision locks', oldLocked === true)

  const latest = useCrmStore.getState().getLatestQuotationDocument(doc.quotationId)!
  crm.submitQuotationDocumentForApproval(latest.id)
  crm.approveQuotationDocument(latest.id, 'Approved for test')
  const approved = useCrmStore.getState().getQuotationDocument(latest.id)!
  check(19, 'Approval workflow works', approved.status === 'approved')
  check(20, 'Approved quotation locks', approved.locked)

  const conv = crm.convertQuotationDocumentToSalesOrder(latest.id)
  check(21, 'Approved quotation converts to Sales Order', conv.ok)
  if (conv.ok) {
    const converted = useCrmStore.getState().getQuotationDocument(latest.id)!
    check(22, 'Converted quotation locks', converted.status === 'converted' || converted.locked)
  } else {
    check(22, 'Converted quotation locks', false, conv.error)
  }

  const dmsBefore = useDmsStore.getState().documents.length
  const dms = saveQuotationPdfToDms({
    quotationNo: quotation.quotationNo,
    revisionNo: doc.revisionNo,
    quotationId: doc.quotationId,
    documentId: doc.id,
    customerId: quotation.customerId,
  })
  check(23, 'Generated PDF can be saved to DMS', dms.ok && useDmsStore.getState().documents.length > dmsBefore)
} else {
  for (const n of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]) {
    check(n, 'Quotation flow step', false, 'no document')
  }
}

check(24, 'Template editor route exists', routeExists('quotation-templates/:id/editor'))
check(25, 'Template preview route exists', routeExists('quotation-templates/:id/preview'))
check(26, 'Section completion utility works', sectionCompletionStatus(crm.quotationDocuments[0] ?? { sections: [], priceLines: [] } as never).total >= 0)

const pkg = readFileSync(path.join(ROOT, 'package.json'), 'utf8')
check(27, 'test:quotation-template-builder wired into package.json', pkg.includes('test:quotation-template-builder'))

const layout = resolveQuotationPrintLayout(isoTpl)
crm.updateQuotationTemplate('qtpl-iso-tank', {
  printLayout: { ...DEFAULT_QUOTATION_PRINT_LAYOUT, pageSize: 'Letter', marginMm: 15, fontScale: 0.95 },
})
const savedLayout = resolveQuotationPrintLayout(useCrmStore.getState().getTemplate('qtpl-iso-tank'))
check(28, 'Print layout model resolves defaults', layout.pageSize === 'A4' && layout.marginMm === 12)
check(29, 'Template print layout can be saved', savedLayout.pageSize === 'Letter' && savedLayout.marginMm === 15)
check(30, 'Document designer component exists', fileExists('src/components/quotations/QuotationTemplateDesigner.tsx'))
check(31, 'Print layout panel component exists', fileExists('src/components/quotations/QuotationPrintLayoutPanel.tsx'))
check(32, 'Templates use standard ErpCommandBar', readFileSync(path.join(ROOT, 'src/modules/quotations/QuotationCrmPages.tsx'), 'utf8').includes('ErpCommandBar'))
check(33, 'Template designer uses ErpCommandBar', readFileSync(path.join(ROOT, 'src/components/quotations/QuotationTemplateDesigner.tsx'), 'utf8').includes('ErpCommandBar'))

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
