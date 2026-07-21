/**
 * Sales lifecycle integration tests
 * npx tsx scripts/test-sales-lifecycle.ts
 */
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
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useSalesStore } = await import('../src/store/salesStore')
const { useCrmStore } = await import('../src/store/crmStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { setSessionUserForTests, resetSessionUserForTests } = await import('../src/utils/permissions')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })
useMrpStore.setState({ runs: [], salesOrders: [] })
usePurchaseStore.setState({ requisitions: [], rfqs: [], purchaseOrders: [], grns: [] })
useSalesStore.setState({ leads: [], inquiries: [], quotations: [] })
useCrmStore.setState({ opportunities: [] })
setSessionUserForTests({ role: 'admin', name: 'Test Admin' })

const sales = useSalesStore.getState()
const crm = useCrmStore.getState()

// Lead
const leadR = sales.createLead({
  prospectName: 'ABC Cement Ltd',
  customerId: 'cust-abc',
  leadOwnerId: 'user-rajesh',
  leadOwnerName: 'Rajesh Kumar',
  expectedValue: 5000000,
  priority: 'medium',
  createdDate: new Date().toISOString().slice(0, 10),
  activityStatus: 'active',
  lifecycleStatus: 'open',
  stage: 'new',
  productRequirement: 'Test bulker requirement',
  remarks: 'Test notes',
  contactPerson: 'Test Contact',
  mobile: '9876543210',
  source: 'referral',
  industry: 'Cement',
  probability: 60,
})
check('Create lead', leadR.ok, leadR.leadId)
const leadId = leadR.leadId!
check('Advance lead to contacted', sales.advanceLeadStage(leadId, 'contacted').ok)
check('Advance lead to qualified', sales.advanceLeadStage(leadId, 'qualified').ok)

// Opportunity from lead
const oppR = crm.createOpportunity({
  customerId: 'cust-abc',
  contactId: null,
  productId: 'prod-45m3',
  opportunityName: 'ABC Bulker Deal',
  productRequirement: 'Test bulker requirement',
  lines: [],
  stage: 'qualified',
  value: 5000000,
  probability: 60,
  expectedCloseDate: '2026-09-01',
  ownerId: 'user-rajesh',
  ownerName: 'Rajesh Kumar',
  priority: 'medium',
  status: 'open',
  lostReason: null,
  leadId,
  inquiryId: null,
  quotationId: null,
  salesOrderId: null,
  nextFollowUpDate: null,
})
check('Create opportunity from lead', oppR.ok, oppR.opportunityId)
const opportunityId = oppR.opportunityId!
check('Lead converted stage', sales.getLead(leadId)!.stage === 'converted_to_opportunity')

// Quotation Rev 1
const quoR = sales.createQuotationFromOpportunity({
  opportunityId,
  opportunityNo: useCrmStore.getState().getOpportunity(opportunityId)!.opportunityNo,
  customerId: 'cust-abc',
  productId: 'prod-45m3',
  qty: 2,
  unitPrice: 3100000,
  discountPct: 2,
})
check('Create quotation Rev 1', quoR.ok, quoR.quotationId)
const quo1Id = quoR.quotationId!
const quo1 = sales.getQuotation(quo1Id)!
check('Quotation revision 1', quo1.revisionNo === 1 && quo1.isLatestRevision)
check('Quotation links opportunity', quo1.opportunityId === opportunityId)
check('Submit for approval', sales.submitQuotationForApproval(quo1Id).ok)
check('Cannot create SO before approval', !sales.createSalesOrderFromQuotation(quo1Id).ok)

// Revision locks previous
const revR = sales.createQuotationRevision(quo1Id, { unitPrice: 3000000, summary: 'Price reduced 3%' })
check('Create Rev 2', revR.ok, revR.quotationId)
const quo2Id = revR.quotationId!
check('Rev 1 locked', sales.getQuotation(quo1Id)!.locked && sales.getQuotation(quo1Id)!.status === 'superseded')
check('Rev 1 cannot be submitted when locked', !sales.submitQuotationForApproval(quo1Id).ok)
check('Rev 2 is latest', sales.getQuotation(quo2Id)!.isLatestRevision)

// Customer approval on Rev 2
check('Submit Rev 2', sales.submitQuotationForApproval(quo2Id).ok)
check('Customer approve', sales.recordCustomerApproval(quo2Id, 'approved').ok)
check('Approved quotation', sales.getQuotation(quo2Id)!.customerApproval === 'approved')

// SO from approved quotation only
const soR = sales.createSalesOrderFromQuotation(quo2Id)
check('Create SO from approved quotation', soR.ok, soR.salesOrderId)
const soId = soR.salesOrderId!
const so = useMrpStore.getState().getSalesOrder(soId)!
check('SO links quotation version', so.quotationId === quo2Id && so.quotationRevisionNo === 2, so.salesOrderNo)
check('Quotation converted', sales.getQuotation(quo2Id)!.status === 'converted')
check('Cannot create duplicate SO', !sales.createSalesOrderFromQuotation(quo2Id).ok)

// MRP gate
check('MRP blocked on open SO', !useMrpStore.getState().runMrpForOrder(soId).ok)
check('Confirm SO', sales.confirmSalesOrder(soId).ok)
const mrpR = sales.triggerProductionForOrder(soId)
check('MRP triggered on confirmed SO', mrpR.ok, mrpR.error)
check('MRP run created', mrpR.runId != null && useMrpStore.getState().getRun(mrpR.runId!) != null)

// Rejection path
const lead2 = sales.createLead({
  remarks: 'Test notes',
  contactPerson: 'Test Contact',
  mobile: '9876543210',
  source: 'cold_call',
  industry: 'Oil',
  customerId: 'cust-ioc',
  prospectName: 'Indian Oil',
  leadOwnerId: 'user-rajesh',
  leadOwnerName: 'Rep 2',
  salesOwner: 'Rep 2',
  priority: 'medium',
  createdDate: new Date().toISOString().slice(0, 10),
  activityStatus: 'active',
  lifecycleStatus: 'open',
  stage: 'new',
  productRequirement: '',
  expectedValue: 8000000,
  probability: 40,
})
const opp2 = crm.createOpportunity({
  customerId: 'cust-ioc',
  contactId: null,
  productId: 'prod-iso',
  opportunityName: 'Indian Oil ISO Tank',
  productRequirement: '',
  lines: [],
  stage: 'proposal',
  value: 8000000,
  probability: 40,
  expectedCloseDate: '2026-10-01',
  ownerId: 'user-rajesh',
  ownerName: 'Rajesh Kumar',
  priority: 'medium',
  status: 'open',
  lostReason: null,
  leadId: lead2.leadId ?? null,
  inquiryId: null,
  quotationId: null,
  salesOrderId: null,
  nextFollowUpDate: null,
})
const q2 = sales.createQuotationFromOpportunity({
  opportunityId: opp2.opportunityId!,
  opportunityNo: useCrmStore.getState().getOpportunity(opp2.opportunityId!)!.opportunityNo,
  customerId: 'cust-ioc',
  productId: 'prod-iso',
  qty: 1,
  unitPrice: 7500000,
})
sales.submitQuotationForApproval(q2.quotationId!)
check('Customer reject', sales.recordCustomerApproval(q2.quotationId!, 'rejected', 'Budget').ok)
check('Rejected cannot create SO', !sales.createSalesOrderFromQuotation(q2.quotationId!).ok)

resetSessionUserForTests()
console.log(`\nSales lifecycle: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
