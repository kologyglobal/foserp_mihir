import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const planLineSchema = z.object({
  parameterId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  mandatoryOverride: z.boolean().nullable().optional(),
  minValueOverride: z.number().nullable().optional(),
  maxValueOverride: z.number().nullable().optional(),
  targetValueOverride: z.number().nullable().optional(),
  severityOverride: z.enum(['MINOR', 'MAJOR', 'CRITICAL']).nullable().optional(),
  photoRequiredOverride: z.boolean().nullable().optional(),
  remarksRequired: z.boolean().optional(),
})

const inspectionCategory = z.enum(['INCOMING', 'IN_PROCESS', 'FINAL', 'SUBCONTRACT_RETURN', 'MATERIAL_RETURN', 'REWORK', 'AD_HOC'])
export const listPlansQuerySchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  category: inspectionCategory.optional(),
  itemId: z.string().uuid().optional(),
})

export const createPlanSchema = z.object({
  planCode: z.string().min(1).max(64),
  planName: z.string().min(1).max(200),
  category: inspectionCategory,
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  itemId: z.string().uuid().nullable().optional(),
  itemCategoryId: z.string().uuid().nullable().optional(),
  operationName: z.string().max(120).nullable().optional(),
  workCenterId: z.string().uuid().nullable().optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  revision: z.string().max(32).nullable().optional(),
  samplingMethod: z.enum(['FULL_INSPECTION', 'FIXED_SAMPLE', 'PERCENTAGE', 'MANUAL_SAMPLE']).optional(),
  sampleSizeMode: z.string().max(32).nullable().optional(),
  fixedSampleSize: z.number().positive().nullable().optional(),
  samplePercentage: z.number().positive().max(100).nullable().optional(),
  certificateRequired: z.boolean().optional(),
  acceptanceRule: z.string().max(64).nullable().optional(),
  lines: z.array(planLineSchema).min(1),
})

export const updatePlanSchema = createPlanSchema.partial().extend({
  planCode: z.string().min(1).max(64).optional(),
  lines: z.array(planLineSchema).min(1).optional(),
})

export const replacePlanLinesSchema = z.object({
  lines: z.array(planLineSchema).min(1),
})
export const revisePlanSchema = z.object({ changeReason: z.string().max(5000).optional(), activate: z.boolean().optional() })

export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>
export type CreatePlanInput = z.infer<typeof createPlanSchema>
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
export type ReplacePlanLinesInput = z.infer<typeof replacePlanLinesSchema>
export type PlanLineInput = z.infer<typeof planLineSchema>
