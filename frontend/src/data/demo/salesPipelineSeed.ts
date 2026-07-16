import type { Lead, Quotation, QuotationPricing } from '../../types/sales'
import { stampCreated } from '../../utils/audit'
import { normalizeLead } from '../../utils/leadUtils'
import { DEMO_CUSTOMER_NAMES, SATURATION_TARGETS } from '../../demo/seeds/demoSeedCatalog'
import { DEMO_QUOTATION_STATUS_CYCLE, demoPipelineLink } from './crmSalesOrderLinkage'

const DEFAULT_GST = 18
const LEAD_COUNT = SATURATION_TARGETS.leads
const QUOTATION_COUNT = SATURATION_TARGETS.quotations

function pricing(qty: number, unitPrice: number): QuotationPricing {
  const subtotal = qty * unitPrice
  const gstAmount = subtotal * (DEFAULT_GST / 100)
  return { unitPrice, discountPct: 0, subtotal, gstPct: DEFAULT_GST, gstAmount, grandTotal: subtotal + gstAmount }
}

const BASE_CUSTOMERS = [
  'cust-abc', 'cust-ultrabuild', 'cust-shree', 'cust-patel', 'cust-metro',
  'cust-national', 'cust-western', 'cust-raj', 'cust-sunrise', 'cust-utcl',
  'cust-ambuja', 'cust-ioc', 'cust-dalmia', 'cust-jsw', 'cust-acc',
] as const

const BASE_PRODUCTS = [
  'prod-45m3', 'prod-iso', 'prod-sidewall', 'prod-tipping', 'prod-cement-bulker',
  'prod-flyash', 'prod-pneumatic', 'prod-lowbed', 'prod-flatbed', 'prod-ss-tank',
  'prod-tanker-30kl', 'prod-bulk-50m3', 'prod-container-40ft', 'prod-dumper-25t', 'prod-chemical-18kl',
] as const

const STAGES: Lead['stage'][] = [
  'new', 'contacted', 'requirement_collected', 'qualified', 'converted_to_opportunity',
  'contacted', 'qualified', 'new', 'not_qualified', 'closed',
]

export function buildDemoSalesPipeline(): { leads: Lead[]; quotations: Quotation[] } {
  const audit = stampCreated()
  const leads: Lead[] = []
  const quotations: Quotation[] = []

  for (let i = 0; i < LEAD_COUNT; i++) {
    const n = String(i + 1).padStart(4, '0')
    const leadId = `lead-demo-${n}`
    const custId = BASE_CUSTOMERS[i % BASE_CUSTOMERS.length]
    const prospect = DEMO_CUSTOMER_NAMES[i % DEMO_CUSTOMER_NAMES.length]

    leads.push(normalizeLead({
      id: leadId,
      leadNo: `LEAD-${n}`,
      source: i % 3 === 0 ? 'existing_customer' : i % 3 === 1 ? 'referral' : 'trade_show',
      industry: 'Cement & Bulk Logistics',
      customerId: custId,
      prospectName: prospect,
      salesOwner: i % 2 === 0 ? 'Rajesh Kumar' : 'Priya Deshmukh',
      leadOwnerId: i % 2 === 0 ? 'user-rajesh' : 'user-priya',
      leadOwnerName: i % 2 === 0 ? 'Rajesh Kumar' : 'Priya Deshmukh',
      expectedValue: 1500000 + i * 175000,
      probability: 35 + (i % 7) * 8,
      stage: STAGES[i % STAGES.length],
      remarks: `Demo lead — ${prospect}`,
      priority: i % 4 === 0 ? 'high' : i % 5 === 0 ? 'critical' : 'medium',
      createdDate: audit.createdAt.slice(0, 10),
      activityStatus: 'active',
      inactiveReason: null,
      lifecycleStatus: STAGES[i % STAGES.length] === 'converted_to_opportunity' ? 'converted' : STAGES[i % STAGES.length] === 'qualified' ? 'qualified' : STAGES[i % STAGES.length] === 'closed' ? 'closed' : 'open',
      closedDate: STAGES[i % STAGES.length] === 'closed' ? audit.createdAt.slice(0, 10) : null,
      closedReason: STAGES[i % STAGES.length] === 'closed' ? 'not_interested' : null,
      notQualifiedReason: STAGES[i % STAGES.length] === 'not_qualified' ? 'no_budget' : null,
      opportunityId: i < QUOTATION_COUNT ? demoPipelineLink(i).opportunityId : null,
      productRequirement: `Demo requirement — ${prospect}`,
      expectedQty: null,
      expectedCloseDate: null,
      contactPerson: null,
      contactId: null,
      mobile: null,
      email: null,
      nextFollowUpDate: null,
      followUpType: null,
      followUpNotes: null,
      locationId: null,
      ...audit,
    }))
  }

  for (let i = 0; i < QUOTATION_COUNT; i++) {
    const link = demoPipelineLink(i)
    const custId = BASE_CUSTOMERS[i % BASE_CUSTOMERS.length]
    const productId = BASE_PRODUCTS[i % BASE_PRODUCTS.length]
    const prospect = DEMO_CUSTOMER_NAMES[i % DEMO_CUSTOMER_NAMES.length]
    const oppNo = `OPP-${String(i + 1).padStart(3, '0')}`

    const unitPrice = 1750000 + i * 95000
    const qty = 1 + (i % 5)
    const isAnchorQuotation = i === 0
    const quoStatus = isAnchorQuotation
      ? 'converted'
      : DEMO_QUOTATION_STATUS_CYCLE[i % DEMO_QUOTATION_STATUS_CYCLE.length]
    const converted = quoStatus === 'converted'
    quotations.push({
      id: link.quotationId,
      quotationNo: link.quotationNo,
      opportunityId: link.opportunityId,
      opportunityNo: oppNo,
      customerId: custId,
      productId,
      qty,
      revisionNo: 1,
      rootQuotationId: link.quotationId,
      isLatestRevision: true,
      locked: converted,
      status: quoStatus,
      customerApproval: quoStatus === 'approved' || converted ? 'approved' : 'pending',
      customerApprovalAt: quoStatus === 'approved' || converted ? audit.createdAt : null,
      customerApprovalBy: quoStatus === 'approved' || converted ? 'Customer Portal' : null,
      customerRejectionReason: null,
      terms: 'Standard manufacturing terms apply.',
      paymentTerms: '30% advance, balance before dispatch',
      deliveryTerms: 'Ex-works Pune, 45 days ARO',
      validityDate: '2026-12-31',
      pricing: pricing(qty, unitPrice),
      changeHistory: [{ revisionNo: 1, changedAt: audit.createdAt, changedByName: audit.createdByName, summary: `Demo quotation — ${prospect}` }],
      salesOrderId: converted ? (isAnchorQuotation ? 'so-0001' : link.salesOrderId) : null,
      salesOrderNo: converted ? (isAnchorQuotation ? 'SO-0001' : link.salesOrderNo) : null,
      ...audit,
    })
  }

  return { leads, quotations }
}
