import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

const policyFields = z.object({
  legalEntityId: z.string().uuid().nullable().optional(),
  plantCode: z.string().trim().max(32).nullable().optional(),
  name: z.string().trim().min(1).max(191),
  costingMethod: z.enum(['ACTUAL', 'PLANNED_AS_PROVISIONAL', 'STANDARD_WITH_VARIANCE']).default('PLANNED_AS_PROVISIONAL'),
  inventoryValuationMethod: z.enum(['MOVING_AVERAGE', 'FIFO']).default('MOVING_AVERAGE'),
  materialValuationSource: z.enum(['MOVEMENT_UNIT_COST', 'PROVISIONAL_RATE']).default('MOVEMENT_UNIT_COST'),
  labourRateSource: z.enum(['WORK_CENTRE_RATE', 'TENANT_DEFAULT', 'LABOUR_RATE_CARD']).default('WORK_CENTRE_RATE'),
  machineRateSource: z.enum(['MACHINE_RATE', 'WORK_CENTRE_RATE']).default('MACHINE_RATE'),
  jobWorkCostSource: z.enum(['LINKED_INVOICE', 'APPROVED_CHARGE', 'PROVISIONAL_RATE']).default('LINKED_INVOICE'),
  overheadMethod: z
    .enum(['NONE', 'PER_LABOUR_HOUR', 'PER_MACHINE_HOUR', 'PER_GOOD_UNIT', 'PERCENT_OF_MATERIAL_COST', 'ACTIVITY_BASED'])
    .default('NONE'),
  overheadRate: z.coerce.number().min(0).default(0),
  defaultLabourRate: z.coerce.number().min(0).default(0),
  defaultMachineRate: z.coerce.number().min(0).default(0),
  fgPostingMode: z.enum(['MANUAL', 'NONE']).default('MANUAL'),
  variancePostingMode: z.enum(['MANUAL', 'NONE']).default('MANUAL'),
  effectiveFrom: z.coerce.date().nullable().optional(),
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
})

export const createCostingPolicySchema = policyFields.superRefine((value, ctx) => {
  if (!['NONE', 'ACTIVITY_BASED'].includes(value.overheadMethod) && value.overheadRate <= 0) {
    ctx.addIssue({ code: 'custom', path: ['overheadRate'], message: 'overheadRate must be positive when overhead is enabled' })
  }
})
export const updateCostingPolicySchema = policyFields.partial()
export const listCostingPoliciesQuerySchema = paginationSchema.extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  plantCode: z.string().trim().max(32).optional(),
})
export const calculateWorkOrderCostSchema = z.object({ persist: z.boolean().default(true) })

export type CreateCostingPolicyInput = z.infer<typeof createCostingPolicySchema>
export type UpdateCostingPolicyInput = z.infer<typeof updateCostingPolicySchema>
export type ListCostingPoliciesQuery = z.infer<typeof listCostingPoliciesQuerySchema>
