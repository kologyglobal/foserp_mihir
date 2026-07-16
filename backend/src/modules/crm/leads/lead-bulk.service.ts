import { prisma } from '../../../config/database.js'
import { assertUserInTenant } from '../crm.tenant-refs.js'
import * as repo from './lead.repository.js'
import {
  assertLeadAssignable,
  assertLeadMutable,
} from './lead.workflow.js'
import type { BulkAssignLeadsInput, BulkStatusLeadsInput } from './lead-bulk.validation.js'

export interface BulkResult {
  requested: number
  processed: number
  failed: number
  failures: Array<{ id: string; message: string }>
}

export async function bulkAssignLeads(
  tenantId: string,
  userId: string,
  input: BulkAssignLeadsInput,
): Promise<BulkResult> {
  await assertUserInTenant(tenantId, input.assignedTo)
  const failures: BulkResult['failures'] = []
  let processed = 0

  for (const leadId of input.leadIds) {
    try {
      const lead = await repo.findLeadById(tenantId, leadId)
      if (!lead) throw new Error('Lead not found')
      assertLeadAssignable(lead)
      await repo.assignLead(tenantId, leadId, userId, {
        leadOwnerId: input.assignedTo,
        notes: input.notes,
      })
      processed += 1
    } catch (err) {
      failures.push({ id: leadId, message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return { requested: input.leadIds.length, processed, failed: failures.length, failures }
}

export async function bulkStatusLeads(
  tenantId: string,
  userId: string,
  input: BulkStatusLeadsInput,
): Promise<BulkResult> {
  const failures: BulkResult['failures'] = []
  let processed = 0

  for (const leadId of input.leadIds) {
    try {
      const lead = await repo.findLeadById(tenantId, leadId)
      if (!lead) throw new Error('Lead not found')
      assertLeadMutable(lead)
      if (input.activityStatus) {
        await repo.updateLead(tenantId, leadId, userId, { activityStatus: input.activityStatus })
      }
      processed += 1
    } catch (err) {
      failures.push({ id: leadId, message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return { requested: input.leadIds.length, processed, failed: failures.length, failures }
}

export async function bulkArchiveLeads(tenantId: string, userId: string, leadIds: string[]): Promise<BulkResult> {
  const failures: BulkResult['failures'] = []
  let processed = 0

  for (const leadId of leadIds) {
    try {
      const lead = await repo.findLeadById(tenantId, leadId)
      if (!lead) throw new Error('Lead not found')
      assertLeadMutable(lead)
      await prisma.crmLead.update({
        where: { id: leadId, tenantId },
        data: { isArchived: true, activityStatus: 'inactive', updatedBy: userId },
      })
      processed += 1
    } catch (err) {
      failures.push({ id: leadId, message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return { requested: leadIds.length, processed, failed: failures.length, failures }
}

export async function bulkRestoreLeads(tenantId: string, userId: string, leadIds: string[]): Promise<BulkResult> {
  const failures: BulkResult['failures'] = []
  let processed = 0

  for (const leadId of leadIds) {
    try {
      const lead = await repo.findLeadById(tenantId, leadId)
      if (!lead) throw new Error('Lead not found')
      await prisma.crmLead.update({
        where: { id: leadId, tenantId },
        data: { isArchived: false, activityStatus: 'active', updatedBy: userId },
      })
      processed += 1
    } catch (err) {
      failures.push({ id: leadId, message: err instanceof Error ? err.message : 'Failed' })
    }
  }

  return { requested: leadIds.length, processed, failed: failures.length, failures }
}
