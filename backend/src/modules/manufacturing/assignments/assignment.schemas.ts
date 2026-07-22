import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const ASSIGNMENT_STATUS_VALUES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const

const quantityField = z.coerce.number().min(0).default(0)

/** Soft shift reference — no Shift master FK until HR module exists. */
const shiftCodeField = z.string().trim().max(32).optional()
const shiftLabelField = z.string().trim().max(64).optional()

export const createAssignmentSchema = z.object({
  productionOrderId: z.string().uuid(),
  stageId: z.string().uuid(),
  operationId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  employeeId: z.string().trim().max(64).optional(),
  machineId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  assignmentDate: z.string().min(4),
  plannedStartAt: z.string().optional(),
  plannedEndAt: z.string().optional(),
  shiftCode: shiftCodeField,
  shiftLabel: shiftLabelField,
  assignedQuantity: z.coerce.number().positive(),
  notes: z.string().trim().max(2000).optional(),
  workInstruction: z.string().trim().max(4000).optional(),
})

export const reassignAssignmentSchema = createAssignmentSchema.omit({ productionOrderId: true, stageId: true }).partial().extend({
  reason: z.string().trim().max(500).optional(),
})

export const cancelAssignmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const pauseAssignmentSchema = z.object({
  reasonType: z
    .enum([
      'MATERIAL_SHORTAGE',
      'MACHINE_BREAKDOWN',
      'TOOL_UNAVAILABLE',
      'POWER_FAILURE',
      'QUALITY_HOLD',
      'OPERATOR_UNAVAILABLE',
      'DRAWING_ISSUE',
      'SPECIFICATION_ISSUE',
      'MAINTENANCE_REQUIRED',
      'VENDOR_DELAY',
      'SAFETY_CONCERN',
      'OTHER',
    ])
    .optional(),
  reasonLabel: z.string().trim().max(200).optional(),
  startDowntime: z.boolean().default(true),
  remarks: z.string().trim().max(2000).optional(),
})

export const completeAssignmentSchema = z
  .object({
    goodQuantity: quantityField,
    reworkQuantity: quantityField,
    rejectedQuantity: quantityField,
    scrapQuantity: quantityField,
    remarks: z.string().trim().max(2000).optional(),
    idempotencyKey: z.string().trim().min(1).max(150),
  })
  .refine((v) => v.goodQuantity + v.reworkQuantity + v.rejectedQuantity + v.scrapQuantity > 0, {
    message: 'At least one quantity must be greater than zero',
  })

export const listAssignmentsQuerySchema = paginationSchema.extend({
  workOrderId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: z.enum(ASSIGNMENT_STATUS_VALUES).optional(),
  assignmentDate: z.string().min(4).optional(),
  shiftCode: shiftCodeField,
})

export const listMyWorkQuerySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  status: z.enum(ASSIGNMENT_STATUS_VALUES).optional(),
  assignmentDate: z.string().min(4).optional(),
})

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>
export type ReassignAssignmentInput = z.infer<typeof reassignAssignmentSchema>
export type CancelAssignmentInput = z.infer<typeof cancelAssignmentSchema>
export type PauseAssignmentInput = z.infer<typeof pauseAssignmentSchema>
export type CompleteAssignmentInput = z.infer<typeof completeAssignmentSchema>
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>
export type ListMyWorkQuery = z.infer<typeof listMyWorkQuerySchema>
