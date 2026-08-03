import { z } from 'zod'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const rosterGridQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  legalEntityId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
})

export const createAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.nullable().optional(),
  source: z.enum(['ROSTER', 'TEMPORARY']).default('ROSTER'),
  note: z.string().max(500).nullable().optional(),
})

export const bulkAssignSchema = z.object({
  employeeIds: z.array(z.string().uuid()).min(1).max(200),
  shiftId: z.string().uuid(),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.nullable().optional(),
  source: z.enum(['ROSTER', 'TEMPORARY']).default('ROSTER'),
  note: z.string().max(500).nullable().optional(),
})

export const copyAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  fromDate: dateSchema,
  toDates: z.array(dateSchema).min(1).max(31),
  source: z.enum(['ROSTER', 'TEMPORARY']).default('ROSTER'),
})

export const clearOverrideSchema = z.object({
  employeeId: z.string().uuid(),
  from: dateSchema,
  to: dateSchema,
  source: z.enum(['ROSTER', 'TEMPORARY']).optional(),
})

export const assignmentIdParamSchema = z.object({
  tenantSlug: z.string().min(1).optional(),
  tenantId: z.string().uuid().optional(),
  assignmentId: z.string().uuid(),
})

export const effectiveShiftQuerySchema = z.object({
  employeeId: z.string().uuid(),
  date: dateSchema,
})

export type RosterGridQuery = z.infer<typeof rosterGridQuerySchema>
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>
export type CopyAssignmentInput = z.infer<typeof copyAssignmentSchema>
export type ClearOverrideInput = z.infer<typeof clearOverrideSchema>
