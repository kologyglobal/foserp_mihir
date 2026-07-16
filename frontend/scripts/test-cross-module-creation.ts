/**
 * Cross-module quick-create acceptance — npm run test:cross-module-creation
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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

const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { seedSalesOrders } = await import('../src/data/mrp/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useCrmStore } = await import('../src/store/crmStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useUIStore } = await import('../src/store/uiStore')
const { setSessionUserForTests, resetSessionUserForTests, canPermission } = await import('../src/utils/permissions')
const { saveQuickCreateEntity } = await import('../src/utils/quickCreateService')
const { canQuickCreateEntity } = await import('../src/utils/quickCreatePermissions')

let passed = 0
let failed = 0

function check(n: number | string, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function fileIncludes(relPath: string, needle: string) {
  const text = readFileSync(path.join(ROOT, relPath), 'utf8')
  return text.includes(needle)
}

function resetTransactional() {
  useInventoryStore.setState({
    stockMovements: [...seedStockMovements],
    reservations: seedReservations.map((r) => ({ ...r })),
  })
  useMrpStore.setState({ runs: [], salesOrders: seedSalesOrders.map((s) => ({ ...s })) })
  useSalesStore.setState({ leads: [], inquiries: [], quotations: [] })
  useCrmStore.setState({ opportunities: [] })
  useWorkOrderStore.setState({
    workOrders: [],
    materialLines: [],
    productionOperations: [],
    jobCards: [],
    subcontractShipments: [],
    fgReceipts: [],
    saReceipts: [],
    activities: [],
  })
  usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
  useQualityStore.setState({ inspections: [], reworks: [], ncrs: [] })
  useDispatchStore.setState({ dispatches: [] })
  useInvoiceStore.setState({ invoices: [] })
  useUIStore.setState({ drawer: null })
}

resetTransactional()
setSessionUserForTests({ role: 'admin', name: 'Quick-Create Audit' })

// ── Store chains (regression) ───────────────────────────────────────────────
const newCustId = useMasterStore.getState().addCustomer({
  customerCode: 'CUST-AUDIT-001',
  customerName: 'Audit Transport Co',
  customerType: 'corporate',
  addressLine1: 'Test Road',
  city: 'Nashik',
  state: 'Maharashtra',
  pincode: '422001',
  gstin: '27AAAAA0000A1Z5',
  contactPerson: 'Audit Contact',
  contactPhone: '9999900001',
  contactEmail: 'audit@example.com',
  creditDays: 30,
  salesTerritory: 'West',
  isActive: true,
})
const oppR = useCrmStore.getState().createOpportunity({
  customerId: newCustId,
  contactId: null,
  productId: 'prod-45m3',
  opportunityName: 'Audit Transport Deal',
  productRequirement: 'Cross-module audit opportunity',
  lines: [],
  stage: 'qualified',
  value: 2500000,
  probability: 50,
  expectedCloseDate: '2026-12-01',
  ownerId: 'user-rajesh',
  ownerName: 'Rajesh Kumar',
  priority: 'medium',
  status: 'open',
  lostReason: null,
  leadId: null,
  inquiryId: null,
  quotationId: null,
  salesOrderId: null,
  nextFollowUpDate: null,
})
check(1, 'Opportunity can use newly created customer (store chain)', oppR.ok && useCrmStore.getState().getOpportunity(oppR.opportunityId!)?.customerId === newCustId)

// ── Quick-create wiring acceptance ────────────────────────────────────────────
check(
  'QC-1',
  'Sales order form wires customer quick-create',
  fileIncludes('src/modules/sales/SalesOrderCreatePage.tsx', 'QuickCreateSelect') &&
    fileIncludes('src/modules/sales/SalesOrderCreatePage.tsx', "entityType=\"customer\""),
)
check(
  'QC-2',
  'Sales order form wires product quick-create',
  fileIncludes('src/modules/sales/SalesOrderCreatePage.tsx', "entityType=\"product\""),
)

let autoSelectedCustomerId = ''
saveQuickCreateEntity('customer', {
  customerName: 'Inline Drawer Customer',
  city: 'Pune',
  gstin: '27DDDDD0000D1Z5',
})
const drawerCust = useMasterStore.getState().customers.find((c) => c.customerName === 'Inline Drawer Customer')
if (drawerCust) autoSelectedCustomerId = drawerCust.id
check(
  'QC-1b',
  'Quick-create customer appears in store for auto-select',
  autoSelectedCustomerId !== '' && useMasterStore.getState().getCustomer(autoSelectedCustomerId) != null,
  autoSelectedCustomerId,
)

const custForContact = useMasterStore.getState().addCustomer({
  customerCode: 'CUST-CONTACT-QC',
  customerName: 'Contact QC Customer',
  customerType: 'dealer',
  addressLine1: 'Lane 2',
  city: 'Nashik',
  state: 'Maharashtra',
  pincode: '422001',
  gstin: '27EEEEE0000E1Z5',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  creditDays: 15,
  salesTerritory: 'West',
  isActive: true,
})
const contactR = saveQuickCreateEntity('contact', {
  customerId: custForContact,
  contactName: 'Ravi Contact',
  mobile: '9999900010',
  email: 'ravi@example.com',
})
check(
  'QC-2b',
  'Contact quick-create saves and links to customer',
  contactR.ok && useMasterStore.getState().getContactsForCustomer(custForContact).length > 0,
)

check(
  'QC-3',
  'Quotation page wires quick-create (payment terms / sales flow)',
  fileIncludes('src/modules/sales/SalesPages.tsx', 'useQuickCreate') &&
    fileIncludes('src/modules/sales/SalesPages.tsx', 'QuickCreateSelect'),
)

check(
  'QC-4',
  'Sales order form supports customer quick-create',
  fileIncludes('src/modules/sales/SalesOrderCreatePage.tsx', 'QuickCreateSelect'),
)

check(
  'QC-5',
  'PR form uses searchable item lookup',
  fileIncludes('src/modules/purchase/PurchaseFormPages.tsx', 'ErpSmartSelect') &&
    fileIncludes('src/modules/purchase/PrLineItemsGrid.tsx', 'itemOptions'),
)

check(
  'QC-6',
  'PO / PR page wires vendor quick-create',
  fileIncludes('src/modules/purchase/PurchasePages.tsx', 'useQuickCreate') &&
    fileIncludes('src/modules/purchase/PurchasePages.tsx', "entityType=\"vendor\""),
)

const vendorInline = saveQuickCreateEntity('vendor', {
  vendorName: 'PO Inline Vendor',
  city: 'Pune',
  gstin: '27FFFFF0000F1Z5',
})
check(
  'QC-6b',
  'Vendor quick-create returns id for auto-select',
  vendorInline.ok && Boolean(vendorInline.ok && vendorInline.result.id),
  vendorInline.ok ? vendorInline.result.id : vendorInline.error,
)

check(
  'QC-7',
  'Job Work send form wires vendor quick-create',
  fileIncludes('src/modules/execution-layer/JobWorkSendReceiveForms.tsx', 'useQuickCreate') &&
    fileIncludes('src/modules/execution-layer/JobWorkSendReceiveForms.tsx', "entityType=\"vendor\""),
)

check(
  'QC-8',
  'Dispatch wires transporter quick-create',
  fileIncludes('src/modules/dispatch/DispatchPages.tsx', 'TransporterQuickCreateField') &&
    fileIncludes('src/modules/dispatch/DispatchPages.tsx', 'useQuickCreate'),
)

const transR = saveQuickCreateEntity('transporter', {
  transporterName: 'QC Express Logistics',
  city: 'Nashik',
})
check('QC-8b', 'Transporter quick-create saves to master store', transR.ok)

check(
  'QC-9',
  'QC missing plan blocker offers inspection plan quick-create',
  fileIncludes('src/components/quick-create/QcPlanMissingBlocker.tsx', 'createInspectionPlan') &&
    fileIncludes('src/modules/quality/QualityPages.tsx', 'QcPlanMissingBlocker'),
)

const planR = saveQuickCreateEntity('inspectionPlan', {
  planName: 'QC Sprint Plan',
  category: 'final',
})
check('QC-9b', 'Inspection plan quick-create saves when permitted', planR.ok, planR.ok ? planR.result.id : planR.error)

setSessionUserForTests({ role: 'shop_floor', name: 'Shop Floor' })
check(
  'QC-10',
  'Unauthorized user cannot quick-create customer',
  !canQuickCreateEntity('customer') && !canPermission('sales', 'create'),
)
setSessionUserForTests({ role: 'admin', name: 'Quick-Create Audit' })

const dupCust = saveQuickCreateEntity('customer', {
  customerName: 'Audit Transport Co',
  customerCode: 'CUST-AUDIT-001',
  city: 'Nashik',
  gstin: '27AAAAA0000A1Z5',
})
check('QC-11a', 'Duplicate customer is blocked', !dupCust.ok)

const dupVendor = saveQuickCreateEntity('vendor', {
  vendorName: 'PO Inline Vendor',
  vendorCode: 'VEND-DUP',
  gstin: '27FFFFF0000F1Z5',
})
check('QC-11b', 'Duplicate vendor is blocked', !dupVendor.ok)

const itemCode = `ITEM-QC-${Date.now().toString().slice(-5)}`
saveQuickCreateEntity('item', {
  itemCode,
  itemName: 'QC Test Item',
})
const dupItem = saveQuickCreateEntity('item', { itemCode, itemName: 'Duplicate Item' })
check('QC-11c', 'Duplicate item code is blocked', !dupItem.ok)

check(
  'QC-12',
  'Drawer open/close preserves ui store without mutating masters',
  (() => {
    const before = useMasterStore.getState().customers.length
    useUIStore.getState().openDrawer('customer', 'Add New Customer', { defaultValues: { customerName: 'Should Not Save' } })
    useUIStore.getState().closeDrawer()
    return useMasterStore.getState().customers.length === before
  })(),
)

const beforeDrop = useMasterStore.getState().vendors.length
const instantVendor = saveQuickCreateEntity('vendor', {
  vendorName: `Instant Vendor ${Date.now()}`,
  gstin: '27GGGGG0000G1Z5',
})
const afterDrop = useMasterStore.getState().vendors.length
check(
  'QC-13',
  'Newly created master appears in store immediately',
  instantVendor.ok && afterDrop === beforeDrop + 1,
  instantVendor.ok ? instantVendor.result.id : '',
)

const beforeCancel = useMasterStore.getState().customers.length
useUIStore.getState().openDrawer('customer', 'Add New Customer')
useUIStore.getState().closeDrawer()
check(
  'QC-14',
  'Cancel drawer does not create record',
  useMasterStore.getState().customers.length === beforeCancel,
)

// ── Legacy store-chain tests (abbreviated) ────────────────────────────────────
setSessionUserForTests({ role: 'admin', name: 'Quick-Create Audit' })
const quoR = useSalesStore.getState().createQuotationFromOpportunity({
  opportunityId: oppR.opportunityId!,
  opportunityNo: useCrmStore.getState().getOpportunity(oppR.opportunityId!)!.opportunityNo,
  customerId: newCustId,
  productId: 'prod-45m3',
  qty: 1,
  unitPrice: 2500000,
})
check(2, 'Quotation can be created from opportunity', quoR.ok, quoR.quotationId)

useSalesStore.getState().submitQuotationForApproval(quoR.quotationId!)
useSalesStore.getState().recordCustomerApproval(quoR.quotationId!, 'approved')
const soR = useSalesStore.getState().createSalesOrderFromQuotation(quoR.quotationId!)
check(3, 'Sales Order can be created from approved quotation', soR.ok, soR.salesOrderId)

const purchItem = useMasterStore.getState().items.find((i) => i.isPurchasable && i.isActive)
const wh = useMasterStore.getState().warehouses.find((w) => w.isActive)!
const prR = usePurchaseStore.getState().createManualPr({
  source: 'manual',
  purpose: 'maintenance',
  lines: purchItem ? [{ itemId: purchItem.id, warehouseId: wh.id, qty: 2, requiredDate: '2026-08-01' }] : [],
})
check(8, 'PR can be created manually', prR.ok && purchItem != null, prR.prId)

resetSessionUserForTests()
console.log(`\n${passed}/${passed + failed} passed`)
process.exit(failed > 0 ? 1 : 0)
