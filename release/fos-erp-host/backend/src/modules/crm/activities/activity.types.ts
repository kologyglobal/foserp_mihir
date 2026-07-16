import type { ActivityStatus, ActivityType, CrmActivity } from '@prisma/client'
import { mapAuditFields, type AuditUserNames, toIso } from '../../../shared/index.js'
import { ACTIVITY_TYPE_TO_FRONTEND, FRONTEND_TYPE_TO_ACTIVITY } from './activity.constants.js'

export interface CrmActivityDto {
  id: string
  type: string
  subject: string
  description: string
  customerId: string | null
  contactId: string | null
  opportunityId: string | null
  quotationId: string | null
  leadId: string | null
  ownerId: string
  ownerName: string
  outcome: string | null
  activityDate: string
  status: string
  priority?: string | null
  scheduledAt?: string | null
  completedAt?: string | null
  nextAction?: string | null
  attachmentNames: string[]
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

function mapActivityStatus(status: ActivityStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'CANCELLED':
      return 'cancelled'
    case 'OVERDUE':
      return 'overdue'
    case 'IN_PROGRESS':
      return 'in_progress'
    default:
      return 'planned'
  }
}

export function mapActivityToDto(activity: CrmActivity, names?: AuditUserNames): CrmActivityDto {
  const ownerId = activity.assignedTo ?? ''
  return {
    id: activity.id,
    type: ACTIVITY_TYPE_TO_FRONTEND[activity.activityType] ?? activity.activityType.toLowerCase(),
    subject: activity.subject,
    description: activity.description ?? '',
    customerId: activity.companyId,
    contactId: activity.contactId,
    opportunityId: activity.opportunityId,
    quotationId: null,
    leadId: activity.leadId,
    ownerId,
    ownerName: names?.ownerName ?? '',
    outcome: activity.outcome,
    activityDate: toIso(activity.scheduledAt) ?? activity.createdAt.toISOString(),
    status: mapActivityStatus(activity.status),
    priority: activity.priority,
    scheduledAt: toIso(activity.scheduledAt),
    completedAt: toIso(activity.completedAt),
    nextAction: activity.nextAction,
    attachmentNames: [],
    ...mapAuditFields(activity, names),
  }
}

export function mapFrontendActivityType(type: string): ActivityType {
  const mapped = FRONTEND_TYPE_TO_ACTIVITY[type]
  return (mapped ?? type.toUpperCase()) as ActivityType
}
