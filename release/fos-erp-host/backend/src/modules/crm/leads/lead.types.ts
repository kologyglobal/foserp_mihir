import type { CrmLead } from '@prisma/client'
import { decimalToNumber, mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'

export interface LeadDto {
  id: string
  leadNo: string
  source: string
  industry: string
  customerId: string | null
  prospectName: string
  salesOwner: string
  leadOwnerId: string
  leadOwnerName: string
  expectedValue: number
  probability: number
  stage: string
  remarks: string
  priority: string
  createdDate: string
  activityStatus: string
  inactiveReason: string | null
  lifecycleStatus: string
  closedDate: string | null
  closedReason: string | null
  notQualifiedReason: string | null
  opportunityId: string | null
  isArchived?: boolean
  productRequirement: string
  expectedQty: number | null
  expectedCloseDate: string | null
  contactPerson: string | null
  mobile: string | null
  email: string | null
  nextFollowUpDate: string | null
  followUpType: string | null
  followUpNotes: string | null
  locationId: string | null
  companyName?: string | null
  contactId?: string | null
  qualificationStatus?: string | null
  temperature?: string | null
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

export function mapLeadToDto(lead: CrmLead, names?: AuditUserNames): LeadDto {
  const ownerId = lead.assignedTo ?? lead.ownerId ?? ''
  const ownerName = names?.leadOwnerName ?? names?.ownerName ?? ''
  return {
    id: lead.id,
    leadNo: lead.leadCode,
    source: lead.source,
    industry: lead.industry ?? '',
    customerId: lead.companyId,
    prospectName: lead.prospectName,
    salesOwner: ownerName,
    leadOwnerId: ownerId,
    leadOwnerName: ownerName,
    expectedValue: decimalToNumber(lead.expectedValue),
    probability: lead.probability,
    stage: lead.stage,
    remarks: lead.remarks ?? '',
    priority: lead.priority,
    createdDate: lead.createdAt.toISOString(),
    activityStatus: lead.activityStatus,
    inactiveReason: lead.inactiveReason,
    lifecycleStatus: lead.lifecycleStatus,
    closedDate: toIso(lead.closedDate),
    closedReason: lead.closedReason,
    notQualifiedReason: lead.notQualifiedReason,
    opportunityId: lead.opportunityId,
    isArchived: lead.isArchived,
    productRequirement: lead.productRequirement ?? '',
    expectedQty: lead.expectedQty,
    expectedCloseDate: toIso(lead.expectedCloseDate),
    contactPerson: lead.contactPerson,
    mobile: lead.mobile,
    email: lead.email,
    nextFollowUpDate: toIso(lead.nextFollowUpAt),
    followUpType: lead.followUpType,
    followUpNotes: lead.followUpNotes,
    locationId: lead.locationId,
    companyName: lead.companyName,
    contactId: lead.contactId,
    qualificationStatus: lead.qualificationStatus,
    temperature: lead.temperature,
    ...mapAuditFields(lead, names),
  }
}
