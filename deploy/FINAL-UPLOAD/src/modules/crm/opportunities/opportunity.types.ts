import type { CrmOpportunity, CrmOpportunityLine, CrmPipelineStage } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'
import { STATUS_TO_FRONTEND } from './opportunity.constants.js'

export interface OpportunityLineDto {
  id: string
  lineNo: number
  productId: string | null
  itemId: string | null
  itemCode: string
  productOrItem: string
  description: string
  productFamily: string
  itemType: string
  qty: number
  uom: string
  unitPrice: number
  discountPct: number
  discountAmount: number
  taxableValue: number
  taxPct: number
  gstAmount: number
  lineTotal: number
  expectedDeliveryDate: string | null
  remarks: string
}

export interface OpportunityDto {
  id: string
  opportunityNo: string
  customerId: string
  contactId: string | null
  productId: string | null
  opportunityName: string
  productRequirement: string
  lines: OpportunityLineDto[]
  stage: string
  value: number
  probability: number
  expectedCloseDate: string
  ownerId: string
  ownerName: string
  priority: string
  status: string
  lostReason: string | null
  healthScore: number
  inquiryId: string | null
  quotationId: string | null
  salesOrderId: string | null
  leadId: string | null
  pipelineId: string
  stageId: string
  lastActivityAt: string | null
  nextFollowUpDate: string | null
  locationId?: string | null
  competitor?: string | null
  winReason?: string | null
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
  approvedById: string | null
  approvedByName: string | null
  approvedAt: string | null
}

export function mapOpportunityLineToDto(line: CrmOpportunityLine): OpportunityLineDto {
  return {
    id: line.id,
    lineNo: line.lineNo,
    productId: line.productId,
    itemId: line.itemId,
    itemCode: line.itemCode,
    productOrItem: line.productOrItem,
    description: line.description ?? '',
    productFamily: line.productFamily ?? '',
    itemType: line.itemType ?? '',
    qty: decimalToNumber(line.qty),
    uom: line.uom,
    unitPrice: decimalToNumber(line.unitPrice),
    discountPct: decimalToNumber(line.discountPct),
    discountAmount: decimalToNumber(line.discountAmount),
    taxableValue: decimalToNumber(line.taxableValue),
    taxPct: decimalToNumber(line.taxPct),
    gstAmount: decimalToNumber(line.gstAmount),
    lineTotal: decimalToNumber(line.lineTotal),
    expectedDeliveryDate: toIso(line.expectedDeliveryDate),
    remarks: line.remarks ?? '',
  }
}

export function mapOpportunityToDto(
  opportunity: CrmOpportunity & { stage?: CrmPipelineStage | null; lines?: CrmOpportunityLine[] },
  names?: AuditUserNames,
): OpportunityDto {
  const stageSlug = opportunity.stage?.slug ?? ''
  return {
    id: opportunity.id,
    opportunityNo: opportunity.opportunityCode,
    customerId: opportunity.companyId,
    contactId: opportunity.contactId,
    productId: null,
    opportunityName: opportunity.name,
    productRequirement: opportunity.requirement ?? '',
    lines: (opportunity.lines ?? []).map(mapOpportunityLineToDto),
    stage: stageSlug,
    value: decimalToNumber(opportunity.amount),
    probability: opportunity.probability,
    expectedCloseDate: toIso(opportunity.expectedCloseDate) ?? '',
    ownerId: opportunity.ownerId ?? '',
    ownerName: names?.ownerName ?? '',
    priority: opportunity.priority,
    status: STATUS_TO_FRONTEND[opportunity.status] ?? opportunity.status.toLowerCase(),
    lostReason: opportunity.lostReason,
    healthScore: opportunity.healthScore,
    inquiryId: null,
    quotationId: null,
    salesOrderId: null,
    leadId: opportunity.leadId,
    pipelineId: opportunity.pipelineId,
    stageId: opportunity.stageId,
    lastActivityAt: toIso(opportunity.lastActivityAt),
    nextFollowUpDate: toIso(opportunity.nextFollowUpAt),
    locationId: opportunity.locationId,
    competitor: opportunity.competitor,
    winReason: opportunity.winReason,
    ...mapAuditFields(opportunity, names),
  }
}
