import type { Customer } from '../../types/master'
import type {
  CrmActivity,
  CrmContact,
  FollowUp,
  Opportunity,
  OpportunityStage,
  QuotationDocument,
  QuotationPriceLine,
  QuotationSection,
} from '../../types/crm'
import { DEFAULT_QUOTATION_TEMPLATES } from '../quotations/quotationTemplates'
import { stampCreated } from '../../utils/audit'
import { syncLineTotals } from '../../utils/crmQuotationCalc'
import { cloneTemplateSections } from '../../utils/quotationEngine/cloneSections'
import { injectIsoTankShowcase } from './isoTankShowcase'
import { demoPipelineLink, isConvertedDemoQuotation, ANCHOR_SO_PIPELINE_INDEX, DEMO_QUOTATION_STATUS_CYCLE } from '../demo/crmSalesOrderLinkage'

const now = () => new Date().toISOString()

const STAGE_DIST: OpportunityStage[] = [
  ...Array(4).fill('new_lead'),
  ...Array(4).fill('qualified'),
  ...Array(4).fill('requirement_discussion'),
  ...Array(3).fill('technical_review'),
  ...Array(3).fill('quotation_prepared'),
  ...Array(3).fill('quotation_sent'),
  ...Array(1).fill('negotiation'),
  ...Array(10).fill('won'),
  ...Array(6).fill('lost'),
  ...Array(2).fill('on_hold'),
] as OpportunityStage[]

const OWNERS = [
  { id: 'user-rajesh', name: 'Rajesh Kumar' },
  { id: 'user-priya', name: 'Priya Deshmukh' },
  { id: 'user-amit', name: 'Amit Sharma' },
]

const PRODUCTS = [
  'prod-45m3', 'prod-iso', 'prod-tipping', 'prod-cement-bulker',
  'prod-flyash', 'prod-flatbed', 'prod-bulk-50m3', 'prod-tanker-30kl',
  'prod-pneumatic', 'prod-container-40ft',
]

const REQUIREMENTS = [
  '45 M3 bulker trailer with pneumatic discharge',
  'ISO tank 20ft ADR compliant',
  'Side wall trailer 35T payload',
  'Low bed for heavy equipment transport',
  'Flatbed 40ft container carrier',
  'Cement bulker 50 M3 capacity',
  'Fly ash bulker with compressor',
  'Spare axle assembly supply',
  'Tipper trailer hydraulic system',
  'Custom tanker fabrication',
]

const REALISTIC_CONTACTS = [
  'Rajesh Mehta',
  'Sanjay Kulkarni',
  'Priya Shah',
  'Nilesh Patel',
  'Ankit Desai',
  'Mehul Trivedi',
  'Deepak Banerjee',
  'Anita Krishnan',
]

const REALISTIC_CUSTOMERS = [
  'ABC Cement Ltd.',
  'UltraTech Cement Ltd.',
  'Western Bulk Logistics',
  'Raj Fleet Movers',
  'Bharat Tanker Logistics',
  'Shree Transport Corporation',
  'National Agro Carriers',
  'Precision Cement Logistics',
  'Apex Chemical Transport',
  'Eagle Bulk Carriers',
  'Metro Mining Logistics',
  'Delta Infrastructure Fleet',
  'Hindustan Bulkers Pvt Ltd',
  'Coastal Freight Solutions',
  'North Star Logistics',
]

const OPPORTUNITY_NAMES = [
  '45M3 Bulker Trailer Requirement',
  'ISO Tanker Fabrication',
  'Side Wall Trailer Fleet Order',
  'Heavy Equipment Transport Trailer',
  'Pneumatic Discharge Trailer',
  'Chemical Tanker Trailer',
  'Custom Low Bed Trailer',
  'Fly Ash Bulker Fleet Expansion',
  'Cement Bulker 50M3 Supply',
  'Flatbed Container Carrier Order',
]

export const CRM_SHOWCASE_CUSTOMER = {
  id: 'cust-crm-01',
  customerCode: 'CUST-CRM-001',
  customerName: 'ChemLogix Partners Pvt Ltd',
  customerType: 'corporate',
  addressLine1: 'GIDC Chemical Zone, Unit 4',
  city: 'Vadodara',
  state: 'Gujarat',
  pincode: '390010',
  gstin: '24AABCC0001Z1',
  contactPerson: 'Rajesh Mehta',
  contactPhone: '+91 9820012345',
  contactEmail: 'procurement@chemlogix.in',
  creditDays: 30,
  salesTerritory: 'West',
  isActive: true,
  createdAt: now(),
} satisfies Customer

export const CRM_EXTENSION_CUSTOMERS: Customer[] = [
  CRM_SHOWCASE_CUSTOMER,
  ...Array.from({ length: 15 }, (_, i): Customer => {
  const n = i + 16
  const cities = ['Indore', 'Nagpur', 'Coimbatore', 'Vizag', 'Bhopal', 'Lucknow', 'Chandigarh', 'Kochi', 'Guwahati', 'Raipur', 'Hubli', 'Mysuru', 'Jodhpur', 'Varanasi', 'Patna']
  return {
    id: `cust-crm-${String(n).padStart(2, '0')}`,
    customerCode: `CUST-CRM-${String(n).padStart(3, '0')}`,
    customerName: REALISTIC_CUSTOMERS[i % REALISTIC_CUSTOMERS.length],
    customerType: i % 3 === 0 ? 'dealer' : 'corporate',
    addressLine1: `Industrial Estate Phase ${(i % 4) + 1}`,
    city: cities[i % cities.length],
    state: 'Maharashtra',
    pincode: '411001',
    gstin: `27AABCC${String(n).padStart(4, '0')}Z1`,
    contactPerson: REALISTIC_CONTACTS[i % REALISTIC_CONTACTS.length],
    contactPhone: `+91 98${String(20000000 + n).slice(0, 8)}`,
    contactEmail: `contact${n}@crmdemo.in`,
    creditDays: 30,
    salesTerritory: i % 2 === 0 ? 'West' : 'North',
    isActive: true,
    createdAt: now(),
  }
}),
]

function offsetDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function offsetDateTime(days: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function defaultPriceLines(productLabel: string, unitPrice: number): QuotationPriceLine[] {
  return syncLineTotals([
    {
      id: `pl-base`,
      productOrItem: productLabel,
      description: 'Main supply as per specification',
      qty: 1,
      uom: 'Nos',
      unitPrice,
      discountPct: 0,
      taxPct: 18,
      lineTotal: 0,
      isOptional: false,
    },
    {
      id: `pl-freight`,
      productOrItem: 'Freight & Insurance',
      description: 'Transport to destination',
      qty: 1,
      uom: 'Lot',
      unitPrice: Math.round(unitPrice * 0.02),
      discountPct: 0,
      taxPct: 18,
      lineTotal: 0,
      isOptional: true,
    },
  ])
}

function sectionsFromTemplate(templateId: string): QuotationSection[] {
  const tpl = DEFAULT_QUOTATION_TEMPLATES.find((t) => t.id === templateId) ?? DEFAULT_QUOTATION_TEMPLATES[0]
  return cloneTemplateSections(tpl.sections, (prefix) => `${prefix}-${templateId}-${Math.random().toString(36).slice(2, 6)}`)
}

export interface CrmSampleBundle {
  contacts: CrmContact[]
  opportunities: Opportunity[]
  activities: CrmActivity[]
  followUps: FollowUp[]
  quotationDocuments: QuotationDocument[]
  quotationTemplates: typeof DEFAULT_QUOTATION_TEMPLATES
}

export function buildCrmSampleData(customerIds: string[]): CrmSampleBundle {
  const audit = stampCreated()
  const allCustomerIds = [...customerIds, ...CRM_EXTENSION_CUSTOMERS.map((c) => c.id)]
  const contacts: CrmContact[] = []
  const opportunities: Opportunity[] = []
  const activities: CrmActivity[] = []
  const followUps: FollowUp[] = []
  const quotationDocuments: QuotationDocument[] = []

  let contactIdx = 0
  for (const custId of allCustomerIds.slice(0, 30)) {
    for (let j = 0; j < 2; j++) {
      contactIdx++
      contacts.push({
        id: `crm-contact-${String(contactIdx).padStart(3, '0')}`,
        contactCode: `CNT-${String(contactIdx).padStart(4, '0')}`,
        customerId: custId,
        name: j === 0
          ? REALISTIC_CONTACTS[contactIdx % REALISTIC_CONTACTS.length]
          : `${REALISTIC_CONTACTS[(contactIdx + 3) % REALISTIC_CONTACTS.length]} (Alt)`,
        designation: j === 0 ? 'Purchase Head' : 'Project Manager',
        email: `contact${contactIdx}@example.com`,
        phone: `+91 98${String(10000000 + contactIdx).slice(0, 8)}`,
        isPrimary: j === 0,
        ...audit,
      })
    }
  }

  for (let i = 0; i < 40; i++) {
    const n = String(i + 1).padStart(3, '0')
    const stage = STAGE_DIST[i] ?? 'new_lead'
    const custId = allCustomerIds[i % allCustomerIds.length]
    const contact = contacts.find((c) => c.customerId === custId && c.isPrimary)
    const owner = OWNERS[i % OWNERS.length]
    const productId = PRODUCTS[i % PRODUCTS.length]
    const value = 1500000 + i * 125000
    const status = stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : stage === 'on_hold' ? 'on_hold' : 'open'
    const quoId = i < 30 ? `quo-demo-${String(i + 1).padStart(4, '0')}` : null

    const opp: Opportunity = {
      id: `opp-crm-${n}`,
      opportunityNo: `OPP-${n}`,
      customerId: custId,
      contactId: contact?.id ?? null,
      productId,
      opportunityName: OPPORTUNITY_NAMES[i % OPPORTUNITY_NAMES.length],
      productRequirement: REQUIREMENTS[i % REQUIREMENTS.length],
      lines: [],
      stage,
      value,
      probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : 20 + (i % 8) * 10,
      expectedCloseDate: offsetDate(15 + (i % 45)),
      ownerId: owner.id,
      ownerName: owner.name,
      priority: i % 5 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
      status,
      lostReason: stage === 'lost' ? 'Lost to competitor on price' : null,
      healthScore: stage === 'won' ? 95 : stage === 'lost' ? 20 : 50 + (i % 40),
      inquiryId: null,
      quotationId: quoId,
      leadId: i < 30 ? `lead-demo-${String(i + 1).padStart(4, '0')}` : null,
      salesOrderId: i === ANCHOR_SO_PIPELINE_INDEX ? 'so-0001' : stage === 'won' && quoId ? demoPipelineLink(i).salesOrderId : null,
      lastActivityAt: offsetDateTime(-(i % 20)),
      nextFollowUpDate: status === 'open' ? offsetDate(i % 7) : null,
      ...audit,
    }
    opportunities.push(opp)

    activities.push({
      id: `act-opp-${n}-1`,
      type: 'note',
      subject: 'Opportunity created',
      description: `New opportunity ${opp.opportunityName} registered in CRM.`,
      customerId: custId,
      contactId: contact?.id ?? null,
      opportunityId: opp.id,
      quotationId: null,
      leadId: null,
      ownerId: owner.id,
      ownerName: owner.name,
      outcome: null,
      activityDate: audit.createdAt,
      attachmentNames: [],
      ...audit,
    })

    if (i % 3 === 0) {
      activities.push({
        id: `act-opp-${n}-2`,
        type: 'call',
        subject: 'Discovery call',
        description: 'Discussed payload, delivery timeline, and payment terms.',
        customerId: custId,
        contactId: contact?.id ?? null,
        opportunityId: opp.id,
        quotationId: null,
        leadId: null,
        ownerId: owner.id,
        ownerName: owner.name,
        outcome: 'Customer interested',
        activityDate: offsetDateTime(-(i % 10)),
        attachmentNames: [],
        ...audit,
      })
    }

    if (status === 'open' && i % 2 === 0) {
      followUps.push({
        id: `fu-opp-${n}`,
        followUpType: i % 4 === 0 ? 'call' : i % 4 === 1 ? 'email' : i % 4 === 2 ? 'meeting' : 'quotation_follow_up',
        customerId: custId,
        contactId: contact?.id ?? null,
        opportunityId: opp.id,
        quotationId: quoId,
        leadId: null,
        assignedTo: owner.id,
        assignedToName: owner.name,
        dueDate: offsetDate(i % 7 === 0 ? 0 : (i % 14) - 3),
        dueTime: '10:30',
        priority: opp.priority,
        status: i % 7 === 0 ? 'overdue' : 'pending',
        outcome: null,
        notes: `Follow up on ${opp.opportunityName}`,
        reminder: true,
        ...audit,
      })
    }
  }

  for (let i = 0; i < 60; i++) {
    const n = String(i + 1).padStart(3, '0')
    const custId = allCustomerIds[i % allCustomerIds.length]
    const opp = opportunities[i % opportunities.length]
    const owner = OWNERS[i % OWNERS.length]
    const types: CrmActivity['type'][] = ['call', 'email', 'meeting', 'note', 'whatsapp', 'site_visit']
    activities.push({
      id: `act-gen-${n}`,
      type: types[i % types.length],
      subject: `Activity ${n}`,
      description: `CRM activity log entry ${n} for customer engagement.`,
      customerId: custId,
      contactId: contacts.find((c) => c.customerId === custId)?.id ?? null,
      opportunityId: i % 2 === 0 ? opp.id : null,
      quotationId: i < 30 ? `quo-demo-${String((i % 30) + 1).padStart(4, '0')}` : null,
      leadId: null,
      ownerId: owner.id,
      ownerName: owner.name,
      outcome: i % 4 === 0 ? 'Needs revised quotation' : null,
      activityDate: offsetDateTime(-(i % 30)),
      attachmentNames: i % 5 === 0 ? ['brochure.pdf'] : [],
      ...audit,
    })
  }

  for (let i = 0; i < 40; i++) {
    const n = String(i + 1).padStart(3, '0')
    const custId = allCustomerIds[i % allCustomerIds.length]
    followUps.push({
      id: `fu-gen-${n}`,
      followUpType: 'payment_follow_up',
      customerId: custId,
      contactId: null,
      opportunityId: null,
      quotationId: null,
      leadId: null,
      assignedTo: OWNERS[i % OWNERS.length].id,
      assignedToName: OWNERS[i % OWNERS.length].name,
      dueDate: offsetDate(i % 5),
      dueTime: '14:00',
      priority: 'medium',
      status: i % 6 === 0 ? 'completed' : 'pending',
      outcome: i % 6 === 0 ? 'Payment received' : null,
      notes: 'General follow-up task',
      reminder: false,
      ...audit,
    })
  }

  const templateIds = DEFAULT_QUOTATION_TEMPLATES.map((t) => t.id)
  for (let i = 0; i < 30; i++) {
    const n = String(i + 1).padStart(4, '0')
    const link = demoPipelineLink(i)
    const tplId = templateIds[i % templateIds.length]
    const unitPrice = 1750000 + i * 95000
    const lines = defaultPriceLines(REQUIREMENTS[i % REQUIREMENTS.length], unitPrice)
    const total = lines.reduce((s, l) => s + l.lineTotal, 0)
    const converted = isConvertedDemoQuotation(i)
    const isAnchorDoc = i === ANCHOR_SO_PIPELINE_INDEX
    const cycleStatus = DEMO_QUOTATION_STATUS_CYCLE[i % DEMO_QUOTATION_STATUS_CYCLE.length]
    const status = isAnchorDoc || converted
      ? 'converted'
      : cycleStatus === 'pending_approval' || cycleStatus === 'approved' || cycleStatus === 'sent' || cycleStatus === 'draft'
        ? cycleStatus
        : 'draft'
    const hasInternalApproval = status === 'approved' || status === 'sent' || status === 'converted'
    quotationDocuments.push({
      id: link.quotationDocumentId,
      quotationId: link.quotationId,
      revisionNo: 1,
      templateId: tplId,
      opportunityId: link.opportunityId,
      sections: sectionsFromTemplate(tplId),
      priceLines: lines,
      freightAmount: 0,
      installationAmount: 0,
      customCharges: 0,
      status,
      totalAmount: total,
      revisionReason: null,
      locked: status === 'approved' || status === 'sent' || status === 'converted',
      approvalHistory: hasInternalApproval
        ? [
            { id: `appr-sub-${n}`, action: 'submitted' as const, byId: 'user-rajesh', byName: 'Rajesh Kumar', at: audit.createdAt, remarks: 'Submitted for approval' },
            { id: `appr-${n}`, action: 'approved' as const, byId: 'user-rajesh', byName: 'Rajesh Kumar', at: audit.createdAt, remarks: 'Demo approved' },
            ...(status === 'sent' || status === 'converted'
              ? [{ id: `appr-sent-${n}`, action: 'sent' as const, byId: 'user-rajesh', byName: 'Rajesh Kumar', at: audit.createdAt, remarks: 'Sent to customer' }]
              : []),
          ]
        : [],
      contactId: contacts.find((c) => c.customerId === allCustomerIds[i % allCustomerIds.length] && c.isPrimary)?.id ?? null,
      salesOwnerId: OWNERS[i % OWNERS.length].id,
      salesOwnerName: OWNERS[i % OWNERS.length].name,
      commercialNotes: REQUIREMENTS[i % REQUIREMENTS.length],
      technicalNotes: REQUIREMENTS[i % REQUIREMENTS.length],
      salesOrderId: isAnchorDoc ? 'so-0001' : converted ? link.salesOrderId : null,
      salesOrderNo: isAnchorDoc ? 'SO-0001' : converted ? link.salesOrderNo : null,
      ...audit,
    })
  }

  for (let i = 0; i < 20; i++) {
    const baseIdx = i % 30
    const n = String(baseIdx + 1).padStart(4, '0')
    const rev = 1 + Math.floor(i / 10)
    const base = quotationDocuments.find((d) => d.quotationId === `quo-demo-${n}` && d.revisionNo === 0)
    if (!base) continue
    const lines = syncLineTotals(
      base.priceLines.map((l) => ({
        ...l,
        id: `${l.id}-r${rev}`,
        unitPrice: l.unitPrice * (1 + rev * 0.02),
      })),
    )
    quotationDocuments.push({
      ...base,
      id: `qdoc-${n}-r${rev}`,
      revisionNo: rev,
      priceLines: lines,
      totalAmount: lines.reduce((s, l) => s + l.lineTotal, 0),
      revisionReason: rev === 1 ? 'Customer requested revised pricing' : 'Scope change',
      locked: true,
      status: 'draft',
      approvalHistory: [],
    })
    const baseDoc = quotationDocuments.find((d) => d.id === base.id)
    if (baseDoc) baseDoc.locked = true
  }

  // Stuck opportunities — no activity for 14+ days in mid-pipeline stages
  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i]
    if (
      opp.status === 'open' &&
      ['requirement_discussion', 'technical_review', 'negotiation'].includes(opp.stage) &&
      i % 3 === 0
    ) {
      opp.lastActivityAt = offsetDateTime(-18)
    }
  }

  // Guarantee 12 follow-ups due today for dashboard command center
  const openOpps = opportunities.filter((o) => o.status === 'open')
  const todayStr = new Date().toISOString().slice(0, 10)
  for (let i = 0; i < 12; i++) {
    const opp = openOpps[i % openOpps.length]
    if (!opp) break
    const owner = OWNERS[i % OWNERS.length]
    followUps.push({
      id: `fu-today-${String(i + 1).padStart(2, '0')}`,
      followUpType: (['call', 'email', 'meeting', 'whatsapp', 'site_visit'] as const)[i % 5],
      customerId: opp.customerId,
      contactId: opp.contactId,
      opportunityId: opp.id,
      quotationId: opp.quotationId,
      leadId: null,
      assignedTo: owner.id,
      assignedToName: owner.name,
      dueDate: todayStr,
      dueTime: `${9 + (i % 8)}:${i % 2 === 0 ? '00' : '30'}`,
      priority: i % 4 === 0 ? 'critical' : i % 3 === 0 ? 'high' : 'medium',
      status: 'pending',
      outcome: null,
      notes: `Today's follow-up: ${opp.opportunityName}`,
      reminder: true,
      ...audit,
    })
  }

  // Additional follow-ups to reach 80+ connected tasks
  for (let i = 0; i < 22; i++) {
    const n = String(i + 1).padStart(3, '0')
    const opp = openOpps[i % openOpps.length]
    if (!opp) break
    followUps.push({
      id: `fu-extra-${n}`,
      followUpType: 'technical_discussion',
      customerId: opp.customerId,
      contactId: opp.contactId,
      opportunityId: opp.id,
      quotationId: opp.quotationId,
      leadId: null,
      assignedTo: OWNERS[i % OWNERS.length].id,
      assignedToName: OWNERS[i % OWNERS.length].name,
      dueDate: offsetDate(2 + (i % 10)),
      dueTime: '11:00',
      priority: 'medium',
      status: 'pending',
      outcome: null,
      notes: `Additional follow-up task ${n}`,
      reminder: false,
      ...audit,
    })
  }

  injectIsoTankShowcase({ contacts, opportunities, quotationDocuments })

  return {
    contacts,
    opportunities,
    activities,
    followUps,
    quotationDocuments,
    quotationTemplates: DEFAULT_QUOTATION_TEMPLATES,
  }
}

export function emptyCrmState(): CrmSampleBundle {
  return {
    contacts: [],
    opportunities: [],
    activities: [],
    followUps: [],
    quotationDocuments: [],
    quotationTemplates: DEFAULT_QUOTATION_TEMPLATES,
  }
}
