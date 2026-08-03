import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import * as repo from './recurring-invoice.repository.js'
import { RecurringInvoiceError } from './recurring-invoice.errors.js'
import type {
  CancelRecurringScheduleInput,
  CreateRecurringScheduleInput,
  ListRecurringSchedulesQueryInput,
  ListUpcomingInvoicesQueryInput,
} from './recurring-invoice.schemas.js'

async function assertBranch(tenantId: string, legalEntityId: string, branchId?: string | null): Promise<void> {
  const branchCheck = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (!branchCheck.valid) {
    throw new RecurringInvoiceError(
      422,
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      'RECURRING_INVOICE_INVALID_BRANCH',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
}

export async function createRecurringSchedule(req: Request, tenantId: string, input: CreateRecurringScheduleInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await assertBranch(tenantId, input.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.template.customerId)

  const schedule = await repo.createScheduleWithFirstExecution(tenantId, {
    legalEntityId: input.legalEntityId,
    branchId: input.branchId,
    frequency: input.frequency,
    startDate: input.startDate,
    endDate: input.endDate,
    template: {
      ...input.template,
      currencyCode: input.template.currencyCode || 'INR',
    },
    createdById: req.context?.userId,
  })

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'recurring_sales_invoice_schedule',
    entityId: schedule.id,
    action: 'RECURRING_INVOICE_SCHEDULE_CREATED',
    newValues: { frequency: schedule.frequency, nextInvoiceDate: schedule.nextInvoiceDate, customerName: party.name },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return schedule
}

export async function listRecurringSchedules(tenantId: string, query: ListRecurringSchedulesQueryInput) {
  return repo.listSchedules(tenantId, query)
}

export async function getRecurringSchedule(tenantId: string, id: string) {
  const schedule = await repo.findScheduleOrThrow(tenantId, id)
  return repo.mapSchedule(schedule)
}

export async function cancelRecurringSchedule(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelRecurringScheduleInput,
) {
  const schedule = await repo.cancelSchedule(tenantId, id, req.context?.userId)
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'recurring_sales_invoice_schedule',
    entityId: id,
    action: 'RECURRING_INVOICE_SCHEDULE_CANCELLED',
    newValues: { reason: input.reason ?? null },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return schedule
}

export async function listUpcomingInvoices(tenantId: string, query: ListUpcomingInvoicesQueryInput) {
  return repo.listUpcomingExecutions(tenantId, query)
}
