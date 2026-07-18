import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { optionalNullablePhoneSchema } from '../../../utils/phoneValidation.js'
import { optionalEmailSchema } from '../../../utils/emailValidation.js'
import { optionalUuid } from '../../../utils/zodHelpers.js'
import {
  LEAD_ACTIVITY_STATUSES,
  LEAD_LIFECYCLE_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STAGES,
} from './lead.constants.js'

export const listLeadsQuerySchema = paginationSchema.extend({
  stage: z.enum(LEAD_STAGES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  lifecycleStatus: z.enum(LEAD_LIFECYCLE_STATUSES).optional(),
  activityStatus: z.enum(LEAD_ACTIVITY_STATUSES).optional(),
  leadOwnerId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  isArchived: z.coerce.boolean().optional(),
})

export const createLeadSchema = z.object({
  leadNo: z.string().trim().max(32).optional(),
  prospectName: z.string().trim().min(1).max(300),
  companyName: z.string().trim().max(300).optional(),
  customerId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  designation: z.string().trim().max(100).optional(),
  email: optionalEmailSchema.optional().nullable().or(z.literal('')),
  mobile: optionalNullablePhoneSchema,
  contactPerson: z.string().trim().max(200).optional().nullable(),
  source: z.enum(LEAD_SOURCES).default('other'),
  industry: z.string().trim().max(100).optional().nullable(),
  turnoverRange: z.string().trim().max(64).optional().nullable(),
  productRequirement: z.string().trim().optional().nullable(),
  expectedQty: z.coerce.number().int().min(0).optional().nullable(),
  expectedValue: z.coerce.number().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  lifecycleStatus: z.enum(LEAD_LIFECYCLE_STATUSES).optional(),
  activityStatus: z.enum(LEAD_ACTIVITY_STATUSES).optional(),
  leadOwnerId: z.string().uuid().optional().nullable(),
  nextFollowUpDate: z.string().datetime().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  remarks: z.string().trim().optional().nullable(),
  followUpType: z.string().trim().max(64).optional().nullable(),
  followUpNotes: z.string().trim().optional().nullable(),
  locationId: optionalUuid,
  temperature: z.string().trim().max(16).optional().nullable(),
})

export const updateLeadSchema = createLeadSchema.partial()

export const assignLeadSchema = z.object({
  leadOwnerId: z.string().uuid(),
  notes: z.string().trim().optional(),
})

export const qualifyLeadSchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  remarks: z.string().trim().optional(),
})

export const disqualifyLeadSchema = z.object({
  notQualifiedReason: z.string().trim().min(1).max(64),
  remarks: z.string().trim().optional(),
})

export const changeLeadStageSchema = z.object({
  stage: z.enum(LEAD_STAGES),
  remarks: z.string().trim().optional(),
  notQualifiedReason: z.string().trim().max(64).optional(),
  closedReason: z.string().trim().max(64).optional(),
  closedDate: z.string().datetime().optional().nullable(),
})

export const convertLeadSchema = z.object({
  opportunityName: z.string().trim().min(1).max(300).optional(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  expectedCloseDate: z.string().datetime().optional(),
  value: z.coerce.number().min(0).optional(),
  lines: z.array(z.object({
    lineNo: z.coerce.number().int().min(1).optional(),
    productId: z.string().uuid().optional().nullable(),
    itemId: z.string().uuid().optional().nullable(),
    itemCode: z.string().trim().max(64).optional(),
    productOrItem: z.string().trim().min(1).max(300),
    description: z.string().trim().optional(),
    productFamily: z.string().trim().max(100).optional(),
    itemType: z.string().trim().max(64).optional(),
    qty: z.coerce.number().min(0).optional(),
    uom: z.string().trim().max(16).optional(),
    unitPrice: z.coerce.number().min(0).optional(),
    discountPct: z.coerce.number().min(0).max(100).optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    taxableValue: z.coerce.number().min(0).optional(),
    taxPct: z.coerce.number().min(0).max(100).optional(),
    gstAmount: z.coerce.number().min(0).optional(),
    lineTotal: z.coerce.number().min(0).optional(),
    expectedDeliveryDate: z.string().datetime().optional().nullable(),
    remarks: z.string().trim().optional(),
  })).optional(),
})

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>
export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type AssignLeadInput = z.infer<typeof assignLeadSchema>
export type QualifyLeadInput = z.infer<typeof qualifyLeadSchema>
export type DisqualifyLeadInput = z.infer<typeof disqualifyLeadSchema>
export type ChangeLeadStageInput = z.infer<typeof changeLeadStageSchema>
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>
