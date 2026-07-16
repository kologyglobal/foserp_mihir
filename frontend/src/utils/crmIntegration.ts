import type { QuotationDocument, QuotationSection, QuotationSectionType } from '../types/crm'
import { calcPriceSummary, syncLineTotals } from './crmQuotationCalc'

export function sectionContent(doc: QuotationDocument, type: QuotationSectionType): string {
  const sec = doc.sections.find((s) => s.sectionType === type)
  return sec?.content?.trim() ?? ''
}

export function primaryPriceLine(doc: QuotationDocument) {
  const lines = syncLineTotals(doc.priceLines)
  return lines.find((l) => !l.isOptional) ?? lines[0]
}

export function documentGrandTotal(doc: QuotationDocument): number {
  const lines = syncLineTotals(doc.priceLines)
  return calcPriceSummary(lines, doc.freightAmount, doc.installationAmount, doc.customCharges).grandTotal
}

export function populateDocumentFromOpportunity(
  sections: QuotationSection[],
  input: {
    customerName: string
    contactName: string
    productRequirement: string
    technicalNotes: string
    commercialNotes: string
    deliveryDate: string
    ownerName: string
  },
): QuotationSection[] {
  return sections.map((s) => {
    if (s.sectionType === 'customer_details') {
      return { ...s, content: `${input.customerName}\nContact: ${input.contactName}\nSales owner: ${input.ownerName}` }
    }
    if (s.sectionType === 'scope' || s.sectionType === 'specification') {
      return { ...s, content: input.productRequirement }
    }
    if (s.sectionType === 'technical') {
      return { ...s, content: input.technicalNotes || input.productRequirement }
    }
    if (s.sectionType === 'commercial') {
      return { ...s, content: input.commercialNotes || s.content }
    }
    if (s.sectionType === 'delivery') {
      const dateLine = input.deliveryDate ? `Expected delivery: ${input.deliveryDate}` : ''
      const content = s.masterCode
        ? (dateLine && !s.content.includes(dateLine) ? `${s.content}\n${dateLine}` : s.content)
        : `${s.content}${dateLine ? `\n${dateLine}` : ''}`
      return { ...s, content }
    }
    return s
  })
}

export interface CrmOrphanReport {
  ok: boolean
  orphanOpportunities: string[]
  orphanDocuments: string[]
  orphanFollowUps: string[]
  orphanActivities: string[]
}

export function validateCrmOrphans(input: {
  customerIds: Set<string>
  salesQuotationIds: Set<string>
  opportunities: { id: string; customerId: string; quotationId: string | null }[]
  quotationDocuments: { id: string; opportunityId: string | null; quotationId: string }[]
  followUps: { id: string; opportunityId: string | null; customerId: string | null }[]
  activities: { id: string; opportunityId: string | null; customerId: string | null; quotationId: string | null }[]
}): CrmOrphanReport {
  const oppIds = new Set(input.opportunities.map((o) => o.id))
  const orphanOpportunities = input.opportunities.filter((o) => !input.customerIds.has(o.customerId)).map((o) => o.id)
  const orphanDocuments = input.quotationDocuments.filter(
    (d) =>
      (d.opportunityId && !oppIds.has(d.opportunityId)) ||
      !input.salesQuotationIds.has(d.quotationId),
  ).map((d) => d.id)
  const orphanFollowUps = input.followUps.filter(
    (f) =>
      (f.opportunityId && !oppIds.has(f.opportunityId)) ||
      (f.customerId && !input.customerIds.has(f.customerId)),
  ).map((f) => f.id)
  const orphanActivities = input.activities.filter(
    (a) =>
      (a.opportunityId && !oppIds.has(a.opportunityId)) ||
      (a.customerId && !input.customerIds.has(a.customerId)) ||
      (a.quotationId && !input.salesQuotationIds.has(a.quotationId)),
  ).map((a) => a.id)
  return {
    ok:
      orphanOpportunities.length === 0 &&
      orphanDocuments.length === 0 &&
      orphanFollowUps.length === 0 &&
      orphanActivities.length === 0,
    orphanOpportunities,
    orphanDocuments,
    orphanFollowUps,
    orphanActivities,
  }
}
