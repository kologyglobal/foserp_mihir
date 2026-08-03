import { z } from 'zod'
import {
  decimalAmountSchema,
  salesInvoiceSupplyTypeSchema,
  salesInvoiceTaxTreatmentSchema,
} from '../shared/receivables.schemas.js'
import { salesInvoiceLineRequestSchema } from '../sales-invoices/sales-invoice.schemas.js'

export const recurringInvoiceFrequencySchema = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'])
export type RecurringInvoiceFrequency = z.infer<typeof recurringInvoiceFrequencySchema>

export const recurringInvoiceScheduleStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED'])
export type RecurringInvoiceScheduleStatus = z.infer<typeof recurringInvoiceScheduleStatusSchema>

export const recurringInvoiceExecutionStatusSchema = z.enum(['SCHEDULED', 'APPROVED', 'SKIPPED', 'CANCELLED'])
export type RecurringInvoiceExecutionStatus = z.infer<typeof recurringInvoiceExecutionStatusSchema>

/** Frozen invoice-creation fields — everything `createSalesInvoiceDraft` needs except the dates,
 * which come from the due execution being approved. Reuses the sales-invoice line schema so
 * recurring lines transform identically to a direct invoice (unitPrice/unitRate, hsnCode, etc). */
export const recurringInvoiceTemplateSchema = z.object({
  customerId: z.string().uuid(),
  supplyType: salesInvoiceSupplyTypeSchema.optional(),
  taxTreatment: salesInvoiceTaxTreatmentSchema,
  currencyCode: z.string().max(8).default('INR'),
  placeOfSupply: z.string().max(8).nullable().optional(),
  narration: z.string().nullable().optional(),
  freightAmount: decimalAmountSchema.optional(),
  otherChargesAmount: decimalAmountSchema.optional(),
  lines: z.array(salesInvoiceLineRequestSchema).min(1),
})
export type RecurringInvoiceTemplateInput = z.infer<typeof recurringInvoiceTemplateSchema>

export const createRecurringScheduleSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  frequency: recurringInvoiceFrequencySchema,
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  template: recurringInvoiceTemplateSchema,
})
export type CreateRecurringScheduleInput = z.infer<typeof createRecurringScheduleSchema>

export const listRecurringSchedulesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: recurringInvoiceScheduleStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
})
export type ListRecurringSchedulesQueryInput = z.infer<typeof listRecurringSchedulesQuerySchema>

export const listUpcomingInvoicesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: recurringInvoiceExecutionStatusSchema.optional(),
})
export type ListUpcomingInvoicesQueryInput = z.infer<typeof listUpcomingInvoicesQuerySchema>

export const cancelRecurringScheduleSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})
export type CancelRecurringScheduleInput = z.infer<typeof cancelRecurringScheduleSchema>

export const recurringExecutionIdParamSchema = z.object({
  id: z.string().uuid(),
  executionId: z.string().uuid(),
})
