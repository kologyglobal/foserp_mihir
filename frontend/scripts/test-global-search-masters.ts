/**
 * Global search master indexing — npm run test:global-search-masters
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

const { runGlobalSearch, buildMasterSearchIndex, searchGlobalIndex } = await import('../src/utils/globalSearchIndex')
const { bom360Path, customer360Path } = await import('../src/config/entity360Routes')
const { useBomStore } = await import('../src/store/bomStore')
const { useMasterStore } = await import('../src/store/masterStore')
const { useWorkCenterStore } = await import('../src/store/workCenterStore')
const { useRoutingStore } = await import('../src/store/routingStore')
const { useCrmMasterStore } = await import('../src/store/crmMasterStore')
const { useCrmStore } = await import('../src/store/crmStore')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function emptyTransactions() {
  return {
    salesOrders: [],
    purchaseOrders: [],
    workOrders: [],
    jobCards: [],
    subcontractShipments: [],
    invoices: [],
    grns: [],
    qrRecords: [],
    serials: [],
    ecos: [],
  }
}

function masterSources() {
  const master = useMasterStore.getState()
  return {
    uoms: master.uoms,
    categories: master.categories,
    items: master.items,
    customers: master.customers,
    vendors: master.vendors,
    warehouses: master.warehouses,
    products: master.products,
    customerContacts: master.customerContacts,
    transporters: master.transporters,
    commercialTerms: master.commercialTerms,
    bomHeaders: useBomStore.getState().bomHeaders,
    workCenters: useWorkCenterStore.getState().workCenters,
    routingHeaders: useRoutingStore.getState().routingHeaders,
    crmMasterEntries: useCrmMasterStore.getState().entries,
    crmContacts: useCrmStore.getState().contacts,
  }
}

function searchMasters(query: string) {
  return searchGlobalIndex(buildMasterSearchIndex(masterSources(), '/masters'), query, 50)
}

console.log('\nGlobal Search Master Index Tests\n')

const item = useMasterStore.getState().items[0]
check('1. Item master indexed by code', !!item && searchMasters(item.itemCode).some((h) => h.type === 'Item' && h.id === item.id))

const product = useMasterStore.getState().products[0]
check(
  '2. Product master indexed by name',
  !!product && searchMasters(product.productName.slice(0, 6)).some((h) => h.type === 'Product' && h.id === product.id),
)

const warehouse = useMasterStore.getState().warehouses[0]
check(
  '3. Warehouse master indexed',
  !!warehouse && searchMasters(warehouse.warehouseCode).some((h) => h.type === 'Warehouse' && h.href.includes(warehouse.id)),
)

const uom = useMasterStore.getState().uoms[0]
check('4. UOM master indexed', !!uom && searchMasters(uom.uomCode).some((h) => h.type === 'UOM'))

const category = useMasterStore.getState().categories[0]
check('5. Item category indexed', !!category && searchMasters(category.categoryCode).some((h) => h.type === 'Category'))

const workCenter = useWorkCenterStore.getState().workCenters[0]
check(
  '6. Work center indexed',
  !!workCenter && searchMasters(workCenter.workCenterCode).some((h) => h.type === 'Work Center'),
)

const routing = useRoutingStore.getState().routingHeaders[0]
check('7. Routing indexed', !!routing && searchMasters(routing.routingNo).some((h) => h.type === 'Routing'))

const customer = useMasterStore.getState().customers.find((c) => c.id === 'cust-abc') ?? useMasterStore.getState().customers[0]
check(
  '8. Company indexed by code',
  !!customer && searchMasters(customer.customerCode).some((h) => h.type === 'Company' && h.href === customer360Path(customer.id)),
)
check(
  '9. Company 360 workspace indexed',
  !!customer && searchMasters(customer.customerCode).some((h) => h.type === 'Company 360'),
)

const gstCustomer = useMasterStore.getState().customers.find((c) => c.gstin && c.gstin.length >= 10)
check(
  '10. Company indexed by GSTIN',
  !!gstCustomer && searchMasters(gstCustomer.gstin.slice(0, 8)).some((h) => h.type === 'Company'),
  gstCustomer?.gstin,
)

const bom = useBomStore.getState().bomHeaders[0]
check(
  '11. BOM and BOM 360 indexed',
  !!bom &&
    searchMasters(bom.bomNo).some((h) => h.type === 'BOM' && h.href === bom360Path(bom.id)) &&
    searchMasters(bom.bomNo).some((h) => h.type === 'BOM 360'),
)

const crmMaster = useCrmMasterStore.getState().entries[0]
check(
  '12. CRM master entry indexed',
  !!crmMaster &&
    searchMasters(crmMaster.code).some((h) => h.type === 'CRM Master' && h.href === `/crm/masters/${crmMaster.kind}/${crmMaster.id}`),
)

const vendor = useMasterStore.getState().vendors[0]
check('13. Vendor indexed', !!vendor && searchMasters(vendor.vendorCode).some((h) => h.type === 'Vendor'))

const transporter = useMasterStore.getState().transporters[0]
check('14. Transporter indexed', !!transporter && searchMasters(transporter.transporterName.slice(0, 5)).some((h) => h.type === 'Transporter'))

const commercialTerm = useMasterStore.getState().commercialTerms[0]
check(
  '15. Commercial term indexed',
  !!commercialTerm && searchMasters(commercialTerm.code).some((h) => h.type === 'Commercial Term'),
)

const contact = useMasterStore.getState().customerContacts[0]
if (contact) {
  check(
    '16. Company contact indexed',
    searchMasters(contact.contactName.slice(0, 4)).some((h) => h.type === 'Company Contact'),
  )
} else {
  const syntheticContact = {
    id: 'test-cc-1',
    customerId: customer?.id ?? 'cust-abc',
    contactName: 'Zeta Procurement Lead',
    designation: 'Purchase Manager',
    mobile: '9999999999',
    email: 'zeta@example.com',
    department: 'Procurement',
    isActive: true,
    createdAt: new Date().toISOString(),
  }
  const contactHits = searchGlobalIndex(
    buildMasterSearchIndex({ ...masterSources(), customerContacts: [syntheticContact] }, '/masters'),
    'zeta procurement',
    10,
  )
  check('16. Company contact indexed', contactHits.some((h) => h.type === 'Company Contact' && h.id === syntheticContact.id))
}

const crmContact = useCrmStore.getState().contacts[0]
if (crmContact) {
  check(
    '17. CRM contact indexed',
    searchMasters(crmContact.name.slice(0, 4)).some((h) => h.type === 'CRM Contact'),
  )
} else {
  const syntheticCrmContact = {
    id: 'test-crm-contact-1',
    customerId: customer?.id ?? 'cust-abc',
    name: 'Zeta CRM Contact',
    designation: 'Director',
    email: 'crm.zeta@example.com',
    phone: '8888888888',
    isPrimary: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system',
  }
  const crmHits = searchGlobalIndex(
    buildMasterSearchIndex({ ...masterSources(), crmContacts: [syntheticCrmContact] }, '/masters'),
    'zeta crm',
    10,
  )
  check('17. CRM contact indexed', crmHits.some((h) => h.type === 'CRM Contact' && h.id === syntheticCrmContact.id))
}

const fullHits = runGlobalSearch('sales', { masters: masterSources(), transactions: emptyTransactions() }, 5)
check('18. Page results included in full search', fullHits.some((h) => h.group === 'page'))

console.log(`\nGlobal search masters: ${passed}/${passed + failed} passed${failed ? `, ${failed} failed` : ''}\n`)
if (failed > 0) process.exit(1)
