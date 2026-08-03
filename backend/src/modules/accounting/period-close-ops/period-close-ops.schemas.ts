import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const TASK_MODULES = [
  'SALES_AR',
  'PURCHASE_AP',
  'INVENTORY',
  'MANUFACTURING',
  'FIXED_ASSETS',
  'BANK_CASH',
  'GST_TDS',
  'GENERAL_LEDGER',
] as const

export const CALENDAR_CATEGORIES = [
  'CHECKLIST',
  'RECONCILIATION',
  'LOCK',
  'YEAR_END',
  'REVIEW',
  'OTHER',
] as const

export const CALENDAR_STATUSES = [
  'UPCOMING',
  'DUE_SOON',
  'DUE_TODAY',
  'OVERDUE',
  'COMPLETED',
  'NOT_APPLICABLE',
] as const

export const TASK_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING',
  'BLOCKED',
  'READY_FOR_REVIEW',
  'COMPLETED',
  'REOPENED',
  'NOT_APPLICABLE',
] as const

export const REOPEN_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'OPEN_TEMPORARILY',
  'EXPIRED',
  'CLOSED',
  'CANCELLED',
] as const

export const REOPEN_REASON_CODES = [
  'INCORRECT_ACCOUNT',
  'INCORRECT_AMOUNT',
  'DUPLICATE_ENTRY',
  'WRONG_PARTY',
  'WRONG_POSTING_DATE',
  'CANCELLED_TRANSACTION',
  'OTHER',
] as const

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

export const listTemplatesQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid(),
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export const createTemplateSchema = z.object({
  legalEntityId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_]+$/, 'code must be UPPER_SNAKE'),
  title: z.string().trim().min(1).max(200),
  module: z.enum(TASK_MODULES),
  defaultOwnerRole: z.string().trim().max(64).optional(),
  defaultDueOffsetDays: z.coerce.number().int().min(-30).max(30).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  blocksClose: z.boolean().optional(),
})

export const updateTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  module: z.enum(TASK_MODULES).optional(),
  defaultOwnerRole: z.string().trim().max(64).nullable().optional(),
  defaultDueOffsetDays: z.coerce.number().int().min(-30).max(30).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  blocksClose: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updateChecklistTaskSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  ownerLabel: z.string().trim().max(120).nullable().optional(),
  reviewerLabel: z.string().trim().max(120).nullable().optional(),
  dueDate: dateOnly.optional(),
  completionPct: z.coerce.number().int().min(0).max(100).optional(),
  evidence: z.string().trim().max(500).nullable().optional(),
  comments: z.string().trim().max(1000).nullable().optional(),
})

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(CALENDAR_CATEGORIES),
  dueDate: dateOnly,
  ownerLabel: z.string().trim().max(120).optional(),
  status: z.enum(CALENDAR_STATUSES).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
})

export const updateCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(CALENDAR_CATEGORIES).optional(),
  dueDate: dateOnly.optional(),
  ownerLabel: z.string().trim().max(120).nullable().optional(),
  status: z.enum(CALENDAR_STATUSES).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
})

export const listReopenRequestsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  status: z.enum(REOPEN_STATUSES).optional(),
})

export const createReopenRequestSchema = z.object({
  legalEntityId: z.string().uuid(),
  periodId: z.string().uuid(),
  moduleLabel: z.string().trim().min(1).max(64),
  reasonCode: z.enum(REOPEN_REASON_CODES),
  reasonDetail: z.string().trim().max(500).optional(),
  documentRef: z.string().trim().max(64).optional(),
  riskExplanation: z.string().trim().min(3).max(2000),
  requestedUntil: dateOnly,
  submit: z.boolean().optional(),
})

export const rejectReopenRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export const approveReopenRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
  /** When true (default), also reopens the accounting period immediately. */
  activate: z.boolean().optional(),
})

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type UpdateChecklistTaskInput = z.infer<typeof updateChecklistTaskSchema>
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>
export type ListReopenRequestsQuery = z.infer<typeof listReopenRequestsQuerySchema>
export type CreateReopenRequestInput = z.infer<typeof createReopenRequestSchema>
export type RejectReopenRequestInput = z.infer<typeof rejectReopenRequestSchema>
export type ApproveReopenRequestInput = z.infer<typeof approveReopenRequestSchema>
