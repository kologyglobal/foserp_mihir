import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { workerCategories } from '../leave/leave.schemas.js'

export const salaryComponentTypes = ['EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'] as const
export const salaryCalculationTypes = [
  'FIXED',
  'PERCENTAGE',
  'ATTENDANCE_LINKED',
  'OT_LINKED',
  'STATUTORY',
] as const
export const salaryStructureVersionStatuses = ['DRAFT', 'ACTIVE', 'SUPERSEDED'] as const
export const salaryAssignmentStatuses = ['DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const boolQueryFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

// ─── Components ────────────────────────────────────────────────────────────

export const listComponentsQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  type: z.enum(salaryComponentTypes).optional(),
  isActive: boolQueryFlag,
  search: z.string().trim().optional(),
})

export const createComponentSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  legalEntityId: z.string().uuid().nullable().optional(),
  type: z.enum(salaryComponentTypes),
  calculationType: z.enum(salaryCalculationTypes),
  taxable: z.boolean().optional(),
  affectsGross: z.boolean().optional(),
  affectsNet: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updateComponentSchema = createComponentSchema.partial()

export const componentIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  componentId: z.string().uuid(),
})

// ─── Structures ────────────────────────────────────────────────────────────

export const listStructuresQuerySchema = paginationSchema.extend({
  legalEntityId: z.string().uuid().optional(),
  workerCategory: z.enum(workerCategories).optional(),
  isActive: boolQueryFlag,
  search: z.string().trim().optional(),
})

export const createStructureSchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  legalEntityId: z.string().uuid().nullable().optional(),
  workerCategory: z.enum(workerCategories).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateStructureSchema = createStructureSchema.partial()

export const structureIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  structureId: z.string().uuid(),
})

// ─── Versions & lines ──────────────────────────────────────────────────────

export const structureLineInputSchema = z.object({
  salaryComponentId: z.string().uuid(),
  sequence: z.number().int().min(0).max(9999).optional(),
  calculationType: z.enum(salaryCalculationTypes),
  fixedAmount: z.number().nonnegative().nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  percentageOfComponentId: z.string().uuid().nullable().optional(),
  monthlyCap: z.number().nonnegative().nullable().optional(),
  annualCap: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const createVersionSchema = z.object({
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  copyFromVersionId: z.string().uuid().optional(),
})

export const updateVersionSchema = z.object({
  effectiveFrom: isoDate.optional(),
  effectiveTo: isoDate.nullable().optional(),
  lines: z.array(structureLineInputSchema).optional(),
})

export const versionIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  versionId: z.string().uuid(),
})

// ─── Assignments ─────────────────────────────────────────────────────────────

export const listAssignmentsQuerySchema = paginationSchema.extend({
  employeeId: z.string().uuid().optional(),
  status: z.enum(salaryAssignmentStatuses).optional(),
})

export const createAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  salaryStructureVersionId: z.string().uuid(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  annualCtc: z.number().nonnegative().nullable().optional(),
  monthlyGross: z.number().nonnegative().nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
  status: z.enum(salaryAssignmentStatuses).optional(),
})

export const reviseAssignmentSchema = z.object({
  salaryStructureVersionId: z.string().uuid(),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable().optional(),
  annualCtc: z.number().nonnegative().nullable().optional(),
  monthlyGross: z.number().nonnegative().nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
})

export const assignmentIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  assignmentId: z.string().uuid(),
})

export const employeeEffectiveQuerySchema = z.object({
  date: isoDate.optional(),
})

export const employeeIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
})

export const previewSalarySchema = z.object({
  employeeId: z.string().uuid().optional(),
  salaryStructureVersionId: z.string().uuid(),
  effectiveDate: isoDate,
})

export type ListComponentsQuery = z.infer<typeof listComponentsQuerySchema>
export type CreateComponentInput = z.infer<typeof createComponentSchema>
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>
export type ListStructuresQuery = z.infer<typeof listStructuresQuerySchema>
export type CreateStructureInput = z.infer<typeof createStructureSchema>
export type UpdateStructureInput = z.infer<typeof updateStructureSchema>
export type StructureLineInput = z.infer<typeof structureLineInputSchema>
export type CreateVersionInput = z.infer<typeof createVersionSchema>
export type UpdateVersionInput = z.infer<typeof updateVersionSchema>
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
export type ReviseAssignmentInput = z.infer<typeof reviseAssignmentSchema>
export type PreviewSalaryInput = z.infer<typeof previewSalarySchema>
