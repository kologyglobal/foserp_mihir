import type { RecurringSalesInvoiceExecution, RecurringSalesInvoiceSchedule } from '@prisma/client'
import type { RecurringInvoiceTemplateInput } from './recurring-invoice.schemas.js'

export interface RecurringInvoiceScheduleDto {
  id: string
  legalEntityId: string
  branchId: string | null
  customerId: string
  status: RecurringSalesInvoiceSchedule['status']
  frequency: RecurringSalesInvoiceSchedule['frequency']
  startDate: string
  endDate: string | null
  nextInvoiceDate: string
  template: RecurringInvoiceTemplateInput
  lastGeneratedAt: string | null
  lastGeneratedForDate: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UpcomingSalesInvoiceDto {
  id: string
  scheduleId: string
  legalEntityId: string
  customerId: string
  frequency: RecurringSalesInvoiceSchedule['frequency']
  scheduleStatus: RecurringSalesInvoiceSchedule['status']
  invoiceDate: string
  status: RecurringSalesInvoiceExecution['status']
  salesInvoiceId: string | null
  failureReason: string | null
  approvedAt: string | null
  createdAt: string
}
