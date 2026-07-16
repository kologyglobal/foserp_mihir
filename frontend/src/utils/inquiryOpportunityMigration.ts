import type { Opportunity, OpportunityLine } from '../types/crm'
import type { Inquiry, Quotation } from '../types/sales'
import type { Product } from '../types/master'
import { buildOpportunityLineFromProduct, syncOpportunityLines } from './opportunityLineCalc'
import { nextDocumentNo } from './documentNumbers'
import { stampCreated } from './audit'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function inquiryStageFromStatus(status: Inquiry['status']): Opportunity['stage'] {
  if (status === 'quoting') return 'quotation_prepared'
  if (status === 'closed' || status === 'cancelled') return 'lost'
  return 'qualified'
}

function buildOpportunityFromInquiry(
  inquiry: Inquiry,
  existingNos: string[],
  getProduct: (id: string) => Product | undefined,
  leadOwner?: { ownerId: string; ownerName: string },
): Opportunity {
  const product = getProduct(inquiry.productId)
  const lines: OpportunityLine[] = product
    ? syncOpportunityLines([
        {
          ...buildOpportunityLineFromProduct(product, undefined, 'Nos', 1),
          qty: inquiry.qty,
          expectedDeliveryDate: inquiry.deliveryExpectation || null,
          remarks: inquiry.notes,
        },
      ])
    : syncOpportunityLines([
        {
          id: genId('opp-line'),
          lineNo: 1,
          productId: inquiry.productId,
          itemId: null,
          itemCode: inquiry.productId,
          productOrItem: inquiry.productId,
          description: inquiry.notes,
          productFamily: '',
          itemType: '',
          qty: inquiry.qty,
          uom: 'Nos',
          unitPrice: 0,
          discountPct: 0,
          discountAmount: 0,
          taxableValue: 0,
          taxPct: 18,
          gstAmount: 0,
          lineTotal: 0,
          expectedDeliveryDate: inquiry.deliveryExpectation || null,
          remarks: inquiry.notes,
        },
      ])

  const audit = stampCreated()
  return {
    id: genId('opp'),
    opportunityNo: nextDocumentNo('OPP', existingNos),
    customerId: inquiry.customerId,
    contactId: null,
    productId: inquiry.productId,
    opportunityName: `Requirement from ${inquiry.inquiryNo}`,
    productRequirement: inquiry.notes,
    lines,
    stage: inquiryStageFromStatus(inquiry.status),
    value: 0,
    probability: 40,
    expectedCloseDate: inquiry.deliveryExpectation || new Date().toISOString().slice(0, 10),
    ownerId: leadOwner?.ownerId ?? audit.createdById,
    ownerName: leadOwner?.ownerName ?? audit.createdByName,
    priority: 'medium',
    status: inquiry.status === 'cancelled' ? 'lost' : 'open',
    lostReason: inquiry.status === 'cancelled' ? 'Migrated from cancelled inquiry' : null,
    healthScore: 55,
    inquiryId: inquiry.id,
    quotationId: null,
    salesOrderId: null,
    leadId: inquiry.leadId,
    lastActivityAt: inquiry.modifiedAt ?? inquiry.createdAt,
    nextFollowUpDate: null,
    ...audit,
  }
}

/** Fold legacy inquiries into opportunities and link sales quotations to opportunities. */
export function migrateInquiriesToOpportunities(
  inquiries: Inquiry[],
  opportunities: Opportunity[],
  quotations: Quotation[],
  getProduct: (id: string) => Product | undefined,
  getLeadOwner?: (leadId: string) => { ownerId: string; ownerName: string } | undefined,
): { opportunities: Opportunity[]; quotations: Quotation[] } {
  if (inquiries.length === 0) {
    const patchedQuotes = quotations.map((q) =>
      q.opportunityId
        ? q
        : {
            ...q,
            opportunityId: opportunities.find((o) => o.inquiryId === q.inquiryId)?.id ?? q.opportunityId ?? null,
            opportunityNo: opportunities.find((o) => o.inquiryId === q.inquiryId)?.opportunityNo ?? q.opportunityNo ?? null,
          },
    )
    return { opportunities, quotations: patchedQuotes }
  }

  let nextOpportunities = [...opportunities]
  const inquiryToOpp = new Map<string, string>()

  for (const opp of nextOpportunities) {
    if (opp.inquiryId) inquiryToOpp.set(opp.inquiryId, opp.id)
  }

  const oppNos = () => nextOpportunities.map((o) => o.opportunityNo)

  for (const inquiry of inquiries) {
    if (inquiryToOpp.has(inquiry.id)) continue
    const owner = inquiry.leadId ? getLeadOwner?.(inquiry.leadId) : undefined
    const opp = buildOpportunityFromInquiry(inquiry, oppNos(), getProduct, owner)
    nextOpportunities = [opp, ...nextOpportunities]
    inquiryToOpp.set(inquiry.id, opp.id)
  }

  const patchedQuotes = quotations.map((q) => {
    const oppId = q.opportunityId ?? (q.inquiryId ? inquiryToOpp.get(q.inquiryId) : null)
    const opp = oppId ? nextOpportunities.find((o) => o.id === oppId) : undefined
    return {
      ...q,
      opportunityId: oppId ?? null,
      opportunityNo: opp?.opportunityNo ?? q.opportunityNo ?? null,
    }
  })

  return { opportunities: nextOpportunities, quotations: patchedQuotes }
}
