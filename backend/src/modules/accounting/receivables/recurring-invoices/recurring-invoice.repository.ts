import { prisma } from '../../../../config/database.js'
import { parseDateOnly, toDateOnlyString } from '../../shared/finance.helpers.js'
import type { RecurringInvoiceTemplateInput } from './recurring-invoice.schemas.js'
import { RecurringInvoiceExecutionNotFoundError, RecurringInvoiceScheduleNotFoundError } from './recurring-invoice.errors.js'
import type { RecurringInvoiceScheduleDto, UpcomingSalesInvoiceDto } from './recurring-invoice.types.js'
import type { RecurringInvoiceExecutionStatus, RecurringInvoiceScheduleStatus } from './recurring-invoice.schemas.js'

export function mapSchedule(row: {
  id: string
  legalEntityId: string
  branchId: string | null
  customerId: string
  status: string
  frequency: string
  startDate: Date
  endDate: Date | null
  nextInvoiceDate: Date
  invoiceTemplate: unknown
  lastGeneratedAt: Date | null
  lastGeneratedForDate: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
}): RecurringInvoiceScheduleDto {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    customerId: row.customerId,
    status: row.status as RecurringInvoiceScheduleDto['status'],
    frequency: row.frequency as RecurringInvoiceScheduleDto['frequency'],
    startDate: toDateOnlyString(row.startDate),
    endDate: row.endDate ? toDateOnlyString(row.endDate) : null,
    nextInvoiceDate: toDateOnlyString(row.nextInvoiceDate),
    template: row.invoiceTemplate as RecurringInvoiceTemplateInput,
    lastGeneratedAt: row.lastGeneratedAt ? row.lastGeneratedAt.toISOString() : null,
    lastGeneratedForDate: row.lastGeneratedForDate ? toDateOnlyString(row.lastGeneratedForDate) : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapExecution(row: {
  id: string
  scheduleId: string
  invoiceDate: Date
  status: string
  salesInvoiceId: string | null
  failureReason: string | null
  approvedAt: Date | null
  createdAt: Date
  schedule: { legalEntityId: string; customerId: string; frequency: string; status: string }
}): UpcomingSalesInvoiceDto {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    legalEntityId: row.schedule.legalEntityId,
    customerId: row.schedule.customerId,
    frequency: row.schedule.frequency as UpcomingSalesInvoiceDto['frequency'],
    scheduleStatus: row.schedule.status as UpcomingSalesInvoiceDto['scheduleStatus'],
    invoiceDate: toDateOnlyString(row.invoiceDate),
    status: row.status as UpcomingSalesInvoiceDto['status'],
    salesInvoiceId: row.salesInvoiceId,
    failureReason: row.failureReason,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createScheduleWithFirstExecution(
  tenantId: string,
  input: {
    legalEntityId: string
    branchId?: string | null
    frequency: string
    startDate: string
    endDate?: string | null
    template: RecurringInvoiceTemplateInput
    createdById?: string
  },
): Promise<RecurringInvoiceScheduleDto> {
  const startDate = parseDateOnly(input.startDate)
  const endDate = input.endDate ? parseDateOnly(input.endDate) : null

  const schedule = await prisma.$transaction(async (tx) => {
    const created = await tx.recurringSalesInvoiceSchedule.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        customerId: input.template.customerId,
        frequency: input.frequency as never,
        startDate,
        endDate,
        nextInvoiceDate: startDate,
        invoiceTemplate: input.template as never,
        createdBy: input.createdById ?? null,
      },
    })
    await tx.recurringSalesInvoiceExecution.create({
      data: {
        tenantId,
        scheduleId: created.id,
        invoiceDate: startDate,
        status: 'SCHEDULED',
      },
    })
    return created
  })

  return mapSchedule(schedule)
}

export async function findScheduleOrThrow(tenantId: string, id: string) {
  const schedule = await prisma.recurringSalesInvoiceSchedule.findFirst({
    where: { id, tenantId, deletedAt: null },
  })
  if (!schedule) throw new RecurringInvoiceScheduleNotFoundError()
  return schedule
}

export async function listSchedules(
  tenantId: string,
  filters: { legalEntityId: string; status?: RecurringInvoiceScheduleStatus; customerId?: string },
): Promise<RecurringInvoiceScheduleDto[]> {
  const rows = await prisma.recurringSalesInvoiceSchedule.findMany({
    where: {
      tenantId,
      legalEntityId: filters.legalEntityId,
      deletedAt: null,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    },
    orderBy: { nextInvoiceDate: 'asc' },
  })
  return rows.map(mapSchedule)
}

export async function cancelSchedule(tenantId: string, id: string, userId?: string): Promise<RecurringInvoiceScheduleDto> {
  const schedule = await findScheduleOrThrow(tenantId, id)
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.recurringSalesInvoiceSchedule.update({
      where: { id: schedule.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: userId ?? null, updatedBy: userId ?? null },
    })
    await tx.recurringSalesInvoiceExecution.updateMany({
      where: { tenantId, scheduleId: schedule.id, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    })
    return row
  })
  return mapSchedule(updated)
}

export async function listUpcomingExecutions(
  tenantId: string,
  filters: { legalEntityId: string; status?: RecurringInvoiceExecutionStatus },
): Promise<UpcomingSalesInvoiceDto[]> {
  const rows = await prisma.recurringSalesInvoiceExecution.findMany({
    where: {
      tenantId,
      status: (filters.status ?? 'SCHEDULED') as never,
      schedule: { legalEntityId: filters.legalEntityId },
    },
    include: { schedule: { select: { legalEntityId: true, customerId: true, frequency: true, status: true } } },
    orderBy: { invoiceDate: 'asc' },
  })
  return rows.map(mapExecution)
}

export async function findExecutionOrThrow(tenantId: string, scheduleId: string, executionId: string) {
  const execution = await prisma.recurringSalesInvoiceExecution.findFirst({
    where: { id: executionId, scheduleId, tenantId },
    include: { schedule: true },
  })
  if (!execution) throw new RecurringInvoiceExecutionNotFoundError()
  return execution
}

export async function markExecutionApproved(
  tenantId: string,
  executionId: string,
  salesInvoiceId: string,
  userId?: string,
) {
  return prisma.recurringSalesInvoiceExecution.updateMany({
    where: { id: executionId, tenantId },
    data: { status: 'APPROVED', salesInvoiceId, approvedAt: new Date(), approvedBy: userId ?? null },
  })
}

export async function advanceScheduleAfterApproval(
  tenantId: string,
  scheduleId: string,
  nextInvoiceDate: Date,
  generatedForDate: Date,
  completed: boolean,
) {
  return prisma.recurringSalesInvoiceSchedule.updateMany({
    where: { id: scheduleId, tenantId },
    data: {
      nextInvoiceDate,
      lastGeneratedAt: new Date(),
      lastGeneratedForDate: generatedForDate,
      ...(completed ? { status: 'COMPLETED' as const } : {}),
    },
  })
}

export async function createNextExecution(tenantId: string, scheduleId: string, invoiceDate: Date) {
  const existing = await prisma.recurringSalesInvoiceExecution.findFirst({
    where: { tenantId, scheduleId, invoiceDate },
  })
  if (existing) return existing
  return prisma.recurringSalesInvoiceExecution.create({
    data: { tenantId, scheduleId, invoiceDate, status: 'SCHEDULED' },
  })
}
