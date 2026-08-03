import type { Request } from 'express'
import type { RecurringSalesInvoiceExecution, RecurringSalesInvoiceSchedule } from '@prisma/client'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { toDateOnlyString } from '../../shared/finance.helpers.js'
import { createSalesInvoiceDraft } from '../sales-invoices/sales-invoice-draft.service.js'
import type { CreateSalesInvoiceInput } from '../sales-invoices/sales-invoice.schemas.js'
import type { RecurringInvoiceTemplateInput } from './recurring-invoice.schemas.js'
import * as repo from './recurring-invoice.repository.js'
import {
  RecurringInvoiceExecutionNotScheduledError,
  RecurringInvoiceScheduleNotActiveError,
} from './recurring-invoice.errors.js'

/** Same cadence math as the treasury StandingInstruction generator — kept local since the two
 * domains (AR invoices vs. bank standing instructions) intentionally don't share a service. */
function advanceDate(date: Date, frequency: RecurringSalesInvoiceSchedule['frequency']): Date {
  const next = new Date(date)
  switch (frequency) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7)
      break
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1)
      break
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3)
      break
    case 'HALF_YEARLY':
      next.setUTCMonth(next.getUTCMonth() + 6)
      break
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1)
      break
  }
  return next
}

function buildCreateInput(
  schedule: RecurringSalesInvoiceSchedule,
  execution: RecurringSalesInvoiceExecution,
): CreateSalesInvoiceInput {
  const template = schedule.invoiceTemplate as unknown as RecurringInvoiceTemplateInput
  const invoiceDate = toDateOnlyString(execution.invoiceDate)
  return {
    legalEntityId: schedule.legalEntityId,
    branchId: schedule.branchId,
    customerId: template.customerId,
    sourceType: 'DIRECT',
    sourceDocumentId: null,
    invoiceDate,
    postingDate: invoiceDate,
    dueDate: null,
    placeOfSupply: template.placeOfSupply ?? null,
    supplyType: template.supplyType,
    taxTreatment: template.taxTreatment,
    currencyCode: template.currencyCode || 'INR',
    exchangeRate: '1',
    taxPricingMode: 'EXCLUSIVE',
    freightMode: 'NON_TAXABLE',
    freightAmount: template.freightAmount ?? '0',
    otherChargesAmount: template.otherChargesAmount ?? '0',
    roundingMode: 'NONE',
    customerPoNumber: null,
    narration: template.narration ?? null,
    lines: template.lines,
  }
}

/**
 * Approve an "upcoming" recurring invoice occurrence: creates the real SalesInvoice draft from
 * the schedule's frozen template, links the execution to it, advances nextInvoiceDate, and eagerly
 * creates the next SCHEDULED execution so the Upcoming queue is always self-sustaining.
 */
export async function approveUpcomingInvoice(
  req: Request,
  tenantId: string,
  scheduleId: string,
  executionId: string,
) {
  const execution = await repo.findExecutionOrThrow(tenantId, scheduleId, executionId)
  const schedule = execution.schedule
  if (schedule.status !== 'ACTIVE') throw new RecurringInvoiceScheduleNotActiveError()
  if (execution.status !== 'SCHEDULED') throw new RecurringInvoiceExecutionNotScheduledError()

  const createInput = buildCreateInput(schedule, execution)
  const invoice = await createSalesInvoiceDraft(req, tenantId, createInput)

  await repo.markExecutionApproved(tenantId, execution.id, invoice.id, req.context?.userId)

  const nextInvoiceDate = advanceDate(execution.invoiceDate, schedule.frequency)
  const completed = Boolean(schedule.endDate && nextInvoiceDate > schedule.endDate)
  await repo.advanceScheduleAfterApproval(tenantId, schedule.id, nextInvoiceDate, execution.invoiceDate, completed)
  if (!completed) {
    await repo.createNextExecution(tenantId, schedule.id, nextInvoiceDate)
  }

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'recurring_sales_invoice_schedule',
    entityId: schedule.id,
    action: 'RECURRING_INVOICE_EXECUTION_APPROVED',
    newValues: { executionId: execution.id, salesInvoiceId: invoice.id, nextInvoiceDate: toDateOnlyString(nextInvoiceDate) },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return invoice
}
