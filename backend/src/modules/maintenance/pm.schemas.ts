import { z } from 'zod'

export const PM_FREQUENCY_TYPES = ['DAYS', 'WEEKS', 'MONTHS'] as const
export const PM_DUE_STATUSES = ['UPCOMING', 'DUE', 'OVERDUE'] as const

const checklistLineSchema = z.object({
  text: z.string().trim().min(1).max(500),
  sequence: z.coerce.number().int().min(1).optional(),
})

export const listPmPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  machineId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
  dueStatus: z.enum(PM_DUE_STATUSES).optional(),
  activeOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
  search: z.string().trim().max(100).optional(),
})

export const createPmPlanSchema = z.object({
  machineId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  frequencyType: z.enum(PM_FREQUENCY_TYPES),
  frequencyValue: z.coerce.number().int().min(1).max(3650),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextDueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  assignedContractorId: z.string().uuid().optional().nullable(),
  estimatedDurationMin: z.coerce.number().int().min(1).max(10080).optional().nullable(),
  checklist: z.array(checklistLineSchema).max(50).optional(),
  isActive: z.boolean().optional().default(true),
})

export const updatePmPlanSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  frequencyType: z.enum(PM_FREQUENCY_TYPES).optional(),
  frequencyValue: z.coerce.number().int().min(1).max(3650).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  assignedContractorId: z.string().uuid().optional().nullable(),
  estimatedDurationMin: z.coerce.number().int().min(1).max(10080).optional().nullable(),
  checklist: z.array(checklistLineSchema).max(50).optional(),
  isActive: z.boolean().optional(),
})

export const createPmTicketSchema = z.object({
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional().default('NORMAL'),
  remarks: z.string().trim().max(2000).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const updateTicketChecklistSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        isDone: z.boolean(),
        remark: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(50),
})

export const pmComplianceQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  machineId: z.string().uuid().optional(),
  workCentreId: z.string().uuid().optional(),
})

export type ListPmPlansQuery = z.infer<typeof listPmPlansQuerySchema>
export type CreatePmPlanInput = z.infer<typeof createPmPlanSchema>
export type UpdatePmPlanInput = z.infer<typeof updatePmPlanSchema>
export type CreatePmTicketInput = z.infer<typeof createPmTicketSchema>
export type UpdateTicketChecklistInput = z.infer<typeof updateTicketChecklistSchema>
export type PmComplianceQuery = z.infer<typeof pmComplianceQuerySchema>
