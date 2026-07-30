import { z } from 'zod'

export const MAINTENANCE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const
export const MAINTENANCE_STATUSES = [
  'REPORTED',
  'IN_REPAIR',
  'WAITING_FOR_PART',
  'ON_HOLD',
  'TESTING',
  'CLOSED',
  'CANCELLED',
] as const
export const TECHNICIAN_TYPES = ['INTERNAL', 'EXTERNAL'] as const
export const TEST_RESULTS = ['PASS', 'FAIL'] as const
export const FAILURE_CATEGORIES = [
  'MECHANICAL',
  'ELECTRICAL',
  'HYDRAULIC',
  'PNEUMATIC',
  'CONTROL',
  'OTHER',
] as const
export const PHOTO_CATEGORIES = ['BEFORE', 'DURING', 'AFTER', 'OTHER'] as const
export const SOURCE_TYPES = ['MANUAL', 'MY_WORK', 'WORK_ORDER', 'JOB_CARD', 'OPERATION'] as const

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  machineId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  priority: z.enum(MAINTENANCE_PRIORITIES).optional(),
  search: z.string().trim().max(100).optional(),
  workOrderId: z.string().uuid().optional(),
  openOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
})

export const MAX_MAINTENANCE_PHOTOS = 4

export const createTicketSchema = z.object({
  machineId: z.string().uuid(),
  problem: z.string().trim().min(3).max(4000),
  priority: z.enum(MAINTENANCE_PRIORITIES).default('NORMAL'),
  remarks: z.string().trim().max(2000).optional(),
  failureCategory: z.enum(FAILURE_CATEGORIES).optional(),
  sourceType: z.enum(SOURCE_TYPES).default('MANUAL'),
  sourceDocumentId: z.string().trim().max(64).optional(),
  workOrderId: z.string().uuid().optional(),
  jobCardId: z.string().trim().max(64).optional(),
  jobCardCode: z.string().trim().max(64).optional(),
  operationId: z.string().uuid().optional(),
  operationCode: z.string().trim().max(64).optional(),
  operationName: z.string().trim().max(200).optional(),
  /** Who is attending / reporting on the floor */
  operatorName: z.string().trim().min(1).max(200).optional(),
  reportedLatitude: z.coerce.number().min(-90).max(90).optional(),
  reportedLongitude: z.coerce.number().min(-180).max(180).optional(),
  reportedAccuracyM: z.coerce.number().min(0).max(100000).optional(),
  reportedLocationLabel: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(1).max(150).optional(),
})

export const startRepairSchema = z
  .object({
    technicianType: z.enum(TECHNICIAN_TYPES),
    technicianUserId: z.string().uuid().optional(),
    contractorId: z.string().uuid().optional(),
    technicianName: z.string().trim().max(200).optional(),
    operatorName: z.string().trim().max(200).optional(),
    startedAt: z.string().datetime().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.technicianType === 'INTERNAL' && !v.technicianUserId && !v.technicianName) {
      ctx.addIssue({
        code: 'custom',
        path: ['technicianUserId'],
        message: 'Internal user/technician is required',
      })
    }
    if (v.technicianType === 'EXTERNAL' && !v.contractorId && !v.technicianName) {
      ctx.addIssue({
        code: 'custom',
        path: ['contractorId'],
        message: 'External contractor/vendor or name is required',
      })
    }
  })

export const updateRepairSchema = z.object({
  repairDetails: z.string().trim().max(8000).optional(),
  failureCategory: z.enum(FAILURE_CATEGORIES).optional().nullable(),
  serviceDescription: z.string().trim().max(4000).optional().nullable(),
  serviceCost: z.coerce.number().min(0).optional(),
  otherCost: z.coerce.number().min(0).optional(),
  invoiceNumber: z.string().trim().max(64).optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  technicianName: z.string().trim().max(200).optional().nullable(),
  contractorId: z.string().uuid().optional().nullable(),
  operatorName: z.string().trim().max(200).optional().nullable(),
})

export const holdTicketSchema = z.object({
  status: z.enum(['ON_HOLD', 'WAITING_FOR_PART']),
  reason: z.string().trim().min(1).max(2000),
})

export const resumeTicketSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const testMachineSchema = z.object({
  result: z.enum(TEST_RESULTS),
  remarks: z.string().trim().max(2000).optional(),
  testedAt: z.string().datetime().optional(),
})

export const closeTicketSchema = z.object({
  closingRemarks: z.string().trim().max(2000).optional(),
})

export const addPartSchema = z.object({
  itemId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  description: z.string().trim().min(1).max(300),
  qty: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(500).optional(),
  shortageQty: z.coerce.number().min(0).optional(),
})

export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  machineId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  status: z.enum(MAINTENANCE_STATUSES).optional(),
  failureCategory: z.enum(FAILURE_CATEGORIES).optional(),
  contractorId: z.string().uuid().optional(),
})

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>
export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type StartRepairInput = z.infer<typeof startRepairSchema>
export type UpdateRepairInput = z.infer<typeof updateRepairSchema>
export type HoldTicketInput = z.infer<typeof holdTicketSchema>
export type ResumeTicketInput = z.infer<typeof resumeTicketSchema>
export type TestMachineInput = z.infer<typeof testMachineSchema>
export type CloseTicketInput = z.infer<typeof closeTicketSchema>
export type AddPartInput = z.infer<typeof addPartSchema>
export type ReportQuery = z.infer<typeof reportQuerySchema>
