import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'

export const listAccountingEventsQuerySchema = paginationSchema.extend({
  productionOrderId: z.string().uuid().optional(),
  eventType: z
    .enum([
      'MATERIAL_RESERVED',
      'MATERIAL_ISSUED',
      'MATERIAL_RETURNED',
      'MATERIAL_CONSUMED',
      'WIP_MOVED',
      'SEMI_FINISHED_RECEIVED',
      'PRODUCTION_COMPLETED',
      'FINISHED_GOODS_RECEIVED',
      'SCRAP_RECORDED',
      'PRODUCTION_ORDER_CLOSED',
      'LABOUR_ABSORPTION',
      'MACHINE_ABSORPTION',
      'OVERHEAD_ABSORPTION',
      'JOB_WORK_RECEIPT_COST',
      'PRODUCTION_VARIANCE',
      'MANUFACTURING_REVERSAL',
    ])
    .optional(),
})

export type ListAccountingEventsQuery = z.infer<typeof listAccountingEventsQuerySchema>

export const FINANCE_FEATURE_KEYS = [
  'RECEIVABLES',
  'PAYABLES',
  'BANK_RECONCILIATION',
  'GST',
  'TDS',
  'FIXED_ASSETS',
  'MANUFACTURING_ACCOUNTING',
  'BUDGETING',
  'MULTI_CURRENCY',
  'COST_CENTRES',
  'PROJECT_ACCOUNTING',
  'APPROVALS',
] as const

export const listFeatureControlsQuerySchema = z.object({
  featureKey: z.enum(FINANCE_FEATURE_KEYS).optional(),
})

export const featureControlParamsSchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const putFeatureControlSchema = z.object({
  isEnabled: z.boolean(),
})

export type ListFeatureControlsQuery = z.infer<typeof listFeatureControlsQuerySchema>
export type PutFeatureControlInput = z.infer<typeof putFeatureControlSchema>
