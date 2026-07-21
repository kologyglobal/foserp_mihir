import type { Quotation } from '../../types/sales'
import type { QuotationDocument, Opportunity, CrmContact } from '../../types/crm'
import type { AuditStamp } from '../../types/audit'
import { stampCreated } from '../../utils/audit'
import { syncLineTotals } from '../../utils/crmQuotationCalc'
import { cloneTemplateSections } from '../../utils/quotationEngine/cloneSections'
import {
  ISO_TANK_26KL_SECTIONS,
  ISO_TANK_SHOWCASE_DOCUMENT_ID,
  ISO_TANK_SHOWCASE_OPPORTUNITY_ID,
  ISO_TANK_SHOWCASE_QUOTATION_ID,
  ISO_TANK_TEMPLATE_ID,
} from '../quotations/templates/isoTank26Kl'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

/** Sample commercial line for 26 KL ISO Tank — matches reference quotation */
export function isoTankSamplePriceLines() {
  return syncLineTotals([
    {
      id: 'pl-iso-26kl-main',
      productOrItem: '26 KL ISO Tank Container',
      productId: 'prod-iso',
      description:
        "20' ISO full frame collar tank, Type UN Portable Tank T7 — SS 316L vessel, CSC / IMDG / ADR compliant, complete fittings, testing, and documentation",
      qty: 1,
      uom: 'Nos',
      unitPrice: 2_850_000,
      discountPct: 0,
      taxPct: 18,
      lineTotal: 0,
      isOptional: false,
    },
  ])
}

export function buildIsoTankShowcaseDocument(audit: AuditStamp & { createdAt: string } = stampCreated()): QuotationDocument {
  const sections = cloneTemplateSections(ISO_TANK_26KL_SECTIONS, genId)
  const priceLines = isoTankSamplePriceLines()
  const total = priceLines.reduce((s, l) => s + l.lineTotal, 0)

  return {
    id: ISO_TANK_SHOWCASE_DOCUMENT_ID,
    quotationId: ISO_TANK_SHOWCASE_QUOTATION_ID,
    revisionNo: 1,
    templateId: ISO_TANK_TEMPLATE_ID,
    opportunityId: ISO_TANK_SHOWCASE_OPPORTUNITY_ID,
    sections,
    priceLines,
    freightAmount: 0,
    installationAmount: 0,
    customCharges: 0,
    status: 'draft',
    totalAmount: total,
    revisionReason: null,
    locked: false,
    approvalHistory: [],
    contactId: null,
    salesOwnerId: 'user-rajesh',
    salesOwnerName: 'Rajesh Kumar',
    commercialNotes: '26 KL ISO Tank Container supply for chemical logistics fleet.',
    technicalNotes: 'SS 316L, UN Portable Tank T7, third-party inspection by customer agency.',
    createdById: audit.createdById,
    createdByName: audit.createdByName,
    createdAt: audit.createdAt,
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export function buildIsoTankShowcaseSalesQuotation(audit: AuditStamp & { createdAt: string } = stampCreated()): Quotation {
  const lines = isoTankSamplePriceLines()
  const taxable = lines[0].qty * lines[0].unitPrice * (1 - lines[0].discountPct / 100)
  const gst = taxable * (lines[0].taxPct / 100)
  const grandTotal = Math.round((taxable + gst) * 100) / 100
  const validity = new Date()
  validity.setDate(validity.getDate() + 30)

  return {
    id: ISO_TANK_SHOWCASE_QUOTATION_ID,
    quotationNo: 'QT-ISO-26KL-001',
    opportunityId: ISO_TANK_SHOWCASE_OPPORTUNITY_ID,
    opportunityNo: 'OPP-ISO-26KL-001',
    customerId: 'cust-crm-01',
    productId: 'prod-iso',
    qty: 1,
    revisionNo: 1,
    rootQuotationId: ISO_TANK_SHOWCASE_QUOTATION_ID,
    isLatestRevision: true,
    locked: false,
    status: 'draft',
    customerApproval: 'pending',
    customerApprovalAt: null,
    customerApprovalBy: null,
    customerRejectionReason: null,
    terms: 'Ex-Works Vadodara. GST @ 18% extra. ADR / ISO / CSC documentation included.',
    paymentTerms: '30% advance, 60% against proforma before dispatch, 10% within 15 days of delivery',
    deliveryTerms: '14–16 weeks from drawing approval and advance',
    validityDate: validity.toISOString().slice(0, 10),
    pricing: {
      unitPrice: lines[0].unitPrice,
      discountPct: 0,
      subtotal: taxable,
      gstPct: 18,
      gstAmount: gst,
      grandTotal,
    },
    changeHistory: [],
    salesOrderId: null,
    salesOrderNo: null,
    createdById: audit.createdById,
    createdByName: audit.createdByName,
    createdAt: audit.createdAt,
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export function buildIsoTankShowcaseOpportunity(audit: AuditStamp & { createdAt: string } = stampCreated()): Opportunity {
  const close = new Date()
  close.setDate(close.getDate() + 45)
  return {
    id: ISO_TANK_SHOWCASE_OPPORTUNITY_ID,
    opportunityNo: 'OPP-ISO-26KL-001',
    customerId: 'cust-crm-01',
    contactId: null,
    productId: 'prod-iso',
    opportunityName: '26 KL ISO Tank Container — Chemical Fleet',
    productRequirement: '26 KL ISO Tank Container, SS 316L, UN Portable Tank T7, ADR/IMDG compliant',
    lines: [],
    stage: 'quotation_prepared',
    value: 3_363_000,
    probability: 65,
    expectedCloseDate: close.toISOString().slice(0, 10),
    ownerId: 'user-rajesh',
    ownerName: 'Rajesh Kumar',
    priority: 'high',
    status: 'open',
    lostReason: null,
    healthScore: 78,
    inquiryId: 'inq-iso-tank-showcase',
    quotationId: ISO_TANK_SHOWCASE_QUOTATION_ID,
    leadId: null,
    salesOrderId: null,
    lastActivityAt: audit.createdAt,
    nextFollowUpDate: close.toISOString().slice(0, 10),
    createdById: audit.createdById,
    createdByName: audit.createdByName,
    createdAt: audit.createdAt,
    modifiedAt: null,
    modifiedById: null,
    modifiedByName: null,
    approvedById: null,
    approvedByName: null,
    approvedAt: null,
  }
}

export interface IsoTankShowcaseBundle {
  opportunity: Opportunity
  document: QuotationDocument
  salesQuotation: Quotation
}

export function buildIsoTankShowcaseBundle(): IsoTankShowcaseBundle {
  const audit = stampCreated()
  return {
    opportunity: buildIsoTankShowcaseOpportunity(audit),
    document: buildIsoTankShowcaseDocument(audit),
    salesQuotation: buildIsoTankShowcaseSalesQuotation(audit),
  }
}

/** Merge showcase records into CRM sample arrays (idempotent) */
export function injectIsoTankShowcase(input: {
  opportunities: Opportunity[]
  quotationDocuments: QuotationDocument[]
  contacts: CrmContact[]
}): void {
  const bundle = buildIsoTankShowcaseBundle()
  if (!input.opportunities.some((o) => o.id === bundle.opportunity.id)) {
    input.opportunities.unshift(bundle.opportunity)
  }
  if (!input.quotationDocuments.some((d) => d.id === bundle.document.id)) {
    input.quotationDocuments.unshift(bundle.document)
  }
  const primaryContact = input.contacts.find((c) => c.customerId === 'cust-crm-01' && c.isPrimary)
  if (primaryContact) {
    bundle.document.contactId = primaryContact.id
    bundle.opportunity.contactId = primaryContact.id
    const doc = input.quotationDocuments.find((d) => d.id === bundle.document.id)
    const opp = input.opportunities.find((o) => o.id === bundle.opportunity.id)
    if (doc) doc.contactId = primaryContact.id
    if (opp) opp.contactId = primaryContact.id
  }
}

export { ISO_TANK_SHOWCASE_DOCUMENT_ID, ISO_TANK_SHOWCASE_OPPORTUNITY_ID, ISO_TANK_SHOWCASE_QUOTATION_ID, ISO_TANK_TEMPLATE_ID } from '../quotations/templates/isoTank26Kl'
