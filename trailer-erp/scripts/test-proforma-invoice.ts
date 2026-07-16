/**
 * Proforma Invoice module tests — npm run test:proforma-invoice
 */
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

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

console.log('\nProforma Invoice Module Tests\n')
mem.clear()

const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')
setSessionUserForTests({ roleId: 'role-sales-head', userId: 'test-sales', userName: 'Sales Head' })

const { useProformaInvoiceStore } = await import('../src/store/proformaInvoiceStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { buildProformaLinesFromSalesOrder } = await import('../src/utils/proformaInvoiceLines')
const { buildProformaNewUrl, resolveSalesOrderProformaPrefill } = await import('../src/utils/proformaInvoicePrefill')

useProformaInvoiceStore.setState({ proformaInvoices: [] })

const customer = useMasterStore.getState().customers.find((c) => c.isActive)!
const product = useMasterStore.getState().products.find((p) => p.isActive && p.status === 'released')!
const so = useMrpStore.getState().salesOrders.find((s) => s.status === 'confirmed') ?? useMrpStore.getState().salesOrders[0]!

check('Store module loads', Boolean(useProformaInvoiceStore.getState().createDirect))
check('Build lines from SO', buildProformaLinesFromSalesOrder(so, useMasterStore.getState().products).length >= 1)
check('Prefill URL', buildProformaNewUrl(so.id).includes(`salesOrderId=${so.id}`))
check('Prefill resolver', Boolean(resolveSalesOrderProformaPrefill(so.id)?.salesOrderNo))

const direct = useProformaInvoiceStore.getState().createDirect({
  customerId: customer.id,
  paymentTerms: '100% advance',
  deliveryTerms: 'Ex-works',
  lines: buildProformaLinesFromSalesOrder({
    ...so,
    id: 'so-test-direct',
    salesOrderNo: 'SO-TEST',
    lines: undefined,
    productId: product.id,
    qty: 2,
    unitPrice: 500000,
  }, useMasterStore.getState().products),
})
check('Direct PI create', direct.ok, direct.id)
const directPi = direct.id ? useProformaInvoiceStore.getState().getProforma(direct.id) : undefined
check('Direct PI numbering', Boolean(directPi?.proformaNo.startsWith('PI-')))

useProformaInvoiceStore.setState({ proformaInvoices: [] })
const fromSo = useProformaInvoiceStore.getState().createFromSalesOrder(so.id)
check('PI from sales order', fromSo.ok, fromSo.id)
const fromSoPi = fromSo.id ? useProformaInvoiceStore.getState().getProforma(fromSo.id) : undefined
check('SO linkage', fromSoPi?.salesOrderId === so.id)
check('Duplicate PI blocked', !useProformaInvoiceStore.getState().createFromSalesOrder(so.id).ok)

if (fromSo.id) {
  const issued = useProformaInvoiceStore.getState().issue(fromSo.id)
  check('Issue proforma', issued.ok)
  check('Issued status', useProformaInvoiceStore.getState().getProforma(fromSo.id)?.status === 'issued')
}

const exportUtil = await import('../src/utils/proformaInvoiceExport.ts')
const exportSrc = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/utils/proformaInvoiceExport.ts', import.meta.url), 'utf8'))
const pagesSrc = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/modules/sales/ProformaInvoicePages.tsx', import.meta.url), 'utf8'))
check('PI PDF export', exportSrc.includes('downloadProformaPdf') && exportSrc.includes('buildProformaPrintHtml'))
check('PI Excel export', exportSrc.includes('downloadProformaExcel') && exportSrc.includes('exportProformaExcelTsv'))
check('Detail page export actions', pagesSrc.includes('Download PDF') && pagesSrc.includes('Export Excel'))
check('PI list BC columns', pagesSrc.includes('ProformaInvoiceTable') && pagesSrc.includes('Customer No.') && pagesSrc.includes('Amount Excl. Tax'))
check('PI nav wired', (await import('node:fs')).readFileSync(new URL('../src/config/navigation.ts', import.meta.url), 'utf8').includes('/sales/proforma-invoices'))
const { readAllRouteSources } = await import('./routeSource')
check('PI routes wired', readAllRouteSources(ROOT).includes('ProformaInvoiceListPage'))
check('PI list uses DataTable', pagesSrc.includes('DataTable') && pagesSrc.includes('exportFileName="proforma-invoices"'))
if (fromSoPi) {
  check('PI GST breakdown', fromSoPi.gst.grandTotal > 0 && fromSoPi.gst.taxableAmount > 0)
  check('PI line totals', fromSoPi.lines.every((l) => l.lineTotal > 0))
  const cancelled = useProformaInvoiceStore.getState().cancel(fromSo.id!)
  check('Cancel issued PI blocked', !cancelled.ok)
}
if (direct.id) {
  const draftCancel = useProformaInvoiceStore.getState().cancel(direct.id)
  check('Cancel draft PI', draftCancel.ok)
  check('Cancelled status', useProformaInvoiceStore.getState().getProforma(direct.id)?.status === 'cancelled')
}
  const tsv = exportUtil.exportProformaExcelTsv(fromSoPi)
  check('Excel TSV has header', tsv.includes('Proforma Invoice') && tsv.includes(fromSoPi.proformaNo))
  const html = exportUtil.buildProformaPrintHtml(fromSoPi)
  check('Print HTML ready', html.includes('PROFORMA INVOICE') && html.includes(fromSoPi.proformaNo))
}

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
