import type { CrmFollowUp } from '@prisma/client'
import { mapAuditFields, type AuditUserNames } from '../../../shared/index.js'

export interface FollowUpDto {
  id: string
  followUpType: string
  customerId: string | null
  contactId: string | null
  opportunityId: string | null
  quotationId: string | null
  leadId: string | null
  assignedTo: string
  assignedToName: string
  dueDate: string
  dueTime: string
  priority: string
  status: string
  outcome: string | null
  notes: string
  reminder: boolean
  createdById: string
  createdByName: string
  createdAt: string
  modifiedById: string | null
  modifiedByName: string | null
  modifiedAt: string | null
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

export function mapFollowUpToDto(followUp: CrmFollowUp, names?: AuditUserNames & { assignedToName?: string }): FollowUpDto {
  const assignedTo = followUp.assignedTo ?? ''
  return {
    id: followUp.id,
    followUpType: followUp.followUpType,
    customerId: followUp.companyId,
    contactId: followUp.contactId,
    opportunityId: followUp.opportunityId,
    quotationId: null,
    leadId: followUp.leadId,
    assignedTo,
    assignedToName: names?.assignedToName ?? '',
    dueDate: formatDateOnly(followUp.dueDate),
    dueTime: followUp.dueTime,
    priority: followUp.priority,
    status: followUp.status,
    outcome: followUp.outcome,
    notes: followUp.notes ?? '',
    reminder: followUp.reminder,
    ...mapAuditFields(followUp, names),
  }
}

export function deriveFollowUpStatus(dueDate: Date, status: string): string {
  if (status === 'completed' || status === 'cancelled' || status === 'snoozed') return status
  const today = new Date().toISOString().slice(0, 10)
  const due = dueDate.toISOString().slice(0, 10)
  if (due < today) return 'overdue'
  return status === 'overdue' ? 'pending' : status
}
