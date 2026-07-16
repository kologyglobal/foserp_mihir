/**
 * CRM execution clarity — npm run test:crm-execution-clarity
 * P2: anchor SO linkage, direct SO confirm, customer 360 sales register.
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
const { useMrpStore } = await import('../src/store/mrpStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { getCustomer360Data } = await import('../src/utils/entity360Metrics')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')

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

console.log('\nCRM Execution Clarity Tests\n')
setSessionUserForTests({ roleId: 'role-sales-manager', userId: 'test-user', userName: 'Test Manager' })
resetCrmBootstrapGuard()
resetDemoBaseline()

const mrp = useMrpStore.getState()
const sales = useSalesStore.getState()

const anchor = mrp.getSalesOrder('so-0001')
check(1, 'SO-0001 has quotation linkage', Boolean(anchor?.quotationId && anchor?.quotationDocumentId))
check(2, 'SO-0001 has opportunity linkage', anchor?.opportunityId === 'opp-crm-001')
check(3, 'SO-0001 has inquiry linkage', anchor?.inquiryId === 'inq-demo-0001')
check(4, 'SO-0001 sourced from quotation', anchor?.source === 'quotation')

const anchorQuo = sales.getQuotation('quo-demo-0001')
check(5, 'Anchor quotation converted to SO-0001', anchorQuo?.status === 'converted' && anchorQuo?.salesOrderId === 'so-0001')

const cust360 = getCustomer360Data('cust-abc')
check(6, 'Customer 360 exposes sales order register', Boolean(cust360?.salesOrders.length))
check(
  7,
  'Customer 360 includes SO-0001 with CRM refs',
  cust360?.salesOrders.some((so) => so.id === 'so-0001' && so.quotationId === 'quo-demo-0001') ?? false,
)

const directSo = mrp.salesOrders.find((s) => s.id === 'so-0180')
const confirmDirect = directSo ? mrp.confirmSalesOrder(directSo.id) : { ok: false }
check(8, 'Direct SO with justification can confirm', confirmDirect.ok, confirmDirect.ok ? '' : (confirmDirect as { error?: string }).error)

const noReason = mrp.addSalesOrderFromQuotation({
  customerId: 'cust-abc',
  productId: 'prod-45m3',
  qty: 1,
  requiredDate: '2026-12-01',
  remarks: 'Test orphan direct',
  source: 'direct',
})
if (noReason.ok && noReason.salesOrderId) {
  const blocked = mrp.confirmSalesOrder(noReason.salesOrderId)
  check(9, 'Direct SO without justification blocked', !blocked.ok)
} else {
  check(9, 'Direct SO without justification blocked', false, 'setup failed')
}

resetSessionUserForTests()
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
