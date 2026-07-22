import { z } from 'zod'
import { paginationSchema } from '../../../utils/pagination.js'
import { PRODUCTION_PRIORITY_VALUES } from '../demands/demand.schemas.js'
import { HOLD_REASON_CATEGORY_VALUES } from '../work-orders/work-order.schemas.js'
import { RUNTIME_CHANGE_RISK_LEVELS, RUNTIME_CHANGE_STATUSES, RUNTIME_CHANGE_TYPES } from './runtime-change.enums.js'
import { RuntimeChangeValidationError } from './runtime-change.errors.js'

export const changeIdParamSchema = z.object({
  changeId: z.string().uuid(),
})

export const listRuntimeChangesQuerySchema = paginationSchema.extend({
  status: z.enum(RUNTIME_CHANGE_STATUSES).optional(),
  changeType: z.enum(RUNTIME_CHANGE_TYPES).optional(),
  riskLevel: z.enum(RUNTIME_CHANGE_RISK_LEVELS).optional(),
})

const baseRuntimeChangeFields = {
  changeType: z.enum(RUNTIME_CHANGE_TYPES),
  stageId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  businessJustification: z.string().trim().max(2000).optional(),
  effectiveDate: z.string().min(4).optional(),
  proposedValue: z.record(z.string(), z.any()),
}

export const previewRuntimeChangeSchema = z.object({
  ...baseRuntimeChangeFields,
})

export const createRuntimeChangeSchema = z.object({
  ...baseRuntimeChangeFields,
  reason: z.string().trim().min(1).max(2000),
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const updateRuntimeChangeSchema = z.object({
  stageId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(2000).optional(),
  businessJustification: z.string().trim().max(2000).optional(),
  effectiveDate: z.string().min(4).optional(),
  proposedValue: z.record(z.string(), z.any()).optional(),
})

export const approveRuntimeChangeSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const rejectRuntimeChangeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const applyRuntimeChangeSchema = z.object({
  idempotencyKey: z.string().trim().max(150).optional(),
})

export const cancelRuntimeChangeSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type ListRuntimeChangesQuery = z.infer<typeof listRuntimeChangesQuerySchema>
export type PreviewRuntimeChangeInput = z.infer<typeof previewRuntimeChangeSchema>
export type CreateRuntimeChangeInput = z.infer<typeof createRuntimeChangeSchema>
export type UpdateRuntimeChangeInput = z.infer<typeof updateRuntimeChangeSchema>
export type ApproveRuntimeChangeInput = z.infer<typeof approveRuntimeChangeSchema>
export type RejectRuntimeChangeInput = z.infer<typeof rejectRuntimeChangeSchema>
export type ApplyRuntimeChangeInput = z.infer<typeof applyRuntimeChangeSchema>
export type CancelRuntimeChangeInput = z.infer<typeof cancelRuntimeChangeSchema>

// ─── Per-changeType proposed-value shapes ───────────────────────────────────
// `proposedValue` is stored verbatim as JSON on the header; these schemas validate
// it against the specific changeType at preview/create/validate/apply time.

export const quantityChangeValueSchema = z.object({
  plannedQuantity: z.coerce.number().positive(),
})

export const dueDateChangeValueSchema = z.object({
  requiredCompletionDate: z.string().min(4),
})

export const priorityChangeValueSchema = z.object({
  priority: z.enum(PRODUCTION_PRIORITY_VALUES),
})

export const supervisorChangeValueSchema = z.object({
  supervisorId: z.string().uuid().nullable(),
})

export const operatorChangeValueSchema = z.object({
  userId: z.string().uuid().nullable(),
  employeeId: z.string().uuid().nullable().optional(),
})

export const machineChangeValueSchema = z.object({
  machineId: z.string().uuid().nullable(),
})

export const workCentreChangeValueSchema = z.object({
  workCentreId: z.string().uuid().nullable(),
})

export const addOperationValueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(32).optional(),
  workCentreId: z.string().uuid().optional(),
  machineId: z.string().uuid().optional(),
  plannedQuantity: z.coerce.number().positive().optional(),
  qualityRequired: z.boolean().optional(),
  isOptional: z.boolean().optional(),
  predecessorOperationIds: z.array(z.string().uuid()).optional(),
})

export const repeatOperationValueSchema = z.object({
  sourceOperationId: z.string().uuid(),
  plannedQuantity: z.coerce.number().positive().optional(),
})

export const skipOperationValueSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
})

export const convertToJobWorkValueSchema = z.object({
  vendorId: z.string().uuid(),
  processName: z.string().trim().min(1).max(200),
  itemId: z.string().uuid(),
  orderedQty: z.coerce.number().positive(),
  rate: z.coerce.number().min(0).default(0),
  rateBasis: z.enum(['PER_PIECE', 'PER_KG', 'PER_HOUR', 'PER_BATCH', 'FIXED']).default('PER_PIECE'),
  materialWarehouseId: z.string().uuid(),
  receiptWarehouseId: z.string().uuid(),
  qualityRequired: z.boolean().optional(),
  materialLines: z
    .array(z.object({ itemId: z.string().uuid(), uomId: z.string().uuid().optional(), requiredQty: z.coerce.number().min(0) }))
    .min(1),
})

export const workOrderHoldValueSchema = z.object({
  reasonCategory: z.enum(HOLD_REASON_CATEGORY_VALUES),
  remarks: z.string().trim().max(2000).optional(),
  expectedResumeAt: z.string().optional(),
})

export const workOrderResumeValueSchema = z.object({
  remarks: z.string().trim().max(2000).optional(),
})

export const stageHoldValueSchema = z.object({
  reasonCategory: z.enum(HOLD_REASON_CATEGORY_VALUES).optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export const stageResumeValueSchema = z.object({}).passthrough()

const PROPOSED_VALUE_SCHEMAS = {
  QUANTITY_CHANGE: quantityChangeValueSchema,
  DUE_DATE_CHANGE: dueDateChangeValueSchema,
  PRIORITY_CHANGE: priorityChangeValueSchema,
  SUPERVISOR_CHANGE: supervisorChangeValueSchema,
  OPERATOR_CHANGE: operatorChangeValueSchema,
  MACHINE_CHANGE: machineChangeValueSchema,
  WORK_CENTRE_CHANGE: workCentreChangeValueSchema,
  ADD_OPERATION: addOperationValueSchema,
  REPEAT_OPERATION: repeatOperationValueSchema,
  SKIP_OPERATION: skipOperationValueSchema,
  CONVERT_TO_JOB_WORK: convertToJobWorkValueSchema,
  WORK_ORDER_HOLD: workOrderHoldValueSchema,
  WORK_ORDER_RESUME: workOrderResumeValueSchema,
  STAGE_HOLD: stageHoldValueSchema,
  STAGE_RESUME: stageResumeValueSchema,
} as const

export type ProposedValueFor<T extends keyof typeof PROPOSED_VALUE_SCHEMAS> = z.infer<(typeof PROPOSED_VALUE_SCHEMAS)[T]>

/** Parses `raw` against the schema registered for `changeType`; throws a field-tagged ValidationError on failure. */
export function parseProposedValue<T extends keyof typeof PROPOSED_VALUE_SCHEMAS>(
  changeType: T,
  raw: unknown,
): ProposedValueFor<T> {
  const schema = PROPOSED_VALUE_SCHEMAS[changeType]
  const result = schema.safeParse(raw ?? {})
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: `proposedValue.${issue.path.join('.')}`,
      message: issue.message,
    }))
    throw new RuntimeChangeValidationError(`Invalid proposed value for change type ${changeType}`, errors)
  }
  return result.data as ProposedValueFor<T>
}
