import { z } from 'zod'

import { paginationSchema } from '../../../utils/pagination.js'



export const RUN_TIME_BASIS_VALUES = ['PER_ORDER', 'PER_UNIT', 'PER_BATCH'] as const

export const IO_TYPE_VALUES = ['MATERIAL', 'SEMI_FINISHED', 'FINISHED_GOOD', 'NONE'] as const

export const DEPENDENCY_TYPE_VALUES = ['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH'] as const

export const STAGE_COMPLETION_RULE_VALUES = [

  'ALL_OPERATIONS',

  'ANY_OPERATION',

  'MANUAL_CONFIRMATION',

  'QUANTITY_TARGET',

] as const

export const PRODUCTION_FLOW_TYPE_VALUES = ['SERIAL', 'PARALLEL'] as const

export const TIME_UNIT_VALUES = ['SECOND', 'MINUTE', 'HOUR', 'DAY', 'WEEK'] as const



export const listRoutingsQuerySchema = paginationSchema.extend({

  isActive: z

    .union([z.boolean(), z.enum(['true', 'false'])])

    .optional()

    .transform((value) => {

      if (value === undefined) return undefined

      if (typeof value === 'boolean') return value

      return value === 'true'

    }),

  productItemId: z.string().uuid().optional(),

})



export const createRoutingSchema = z.object({

  code: z.string().trim().min(1).max(64).optional(),

  name: z.string().trim().min(1).max(300),

  productItemId: z.string().uuid().nullable().optional(),

  description: z.string().trim().max(2000).optional(),

  productionFlowType: z.enum(PRODUCTION_FLOW_TYPE_VALUES).default('SERIAL'),

  isActive: z.boolean().optional(),

})



export const updateRoutingSchema = z.object({

  name: z.string().trim().min(1).max(300).optional(),

  description: z.string().trim().max(2000).nullable().optional(),

  productItemId: z.string().uuid().nullable().optional(),

  productionFlowType: z.enum(PRODUCTION_FLOW_TYPE_VALUES).optional(),

  isActive: z.boolean().optional(),

})



export const listRoutingVersionsQuerySchema = paginationSchema.extend({

  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED', 'ARCHIVED']).optional(),

})



export const createRoutingVersionSchema = z.object({

  revisionCode: z.string().trim().min(1).max(32),

  effectiveFrom: z.coerce.date(),

  effectiveTo: z.coerce.date().nullable().optional(),

  revisionNotes: z.string().trim().max(4000).optional(),

})



export const updateRoutingVersionSchema = z.object({

  revisionCode: z.string().trim().min(1).max(32).optional(),

  effectiveFrom: z.coerce.date().optional(),

  effectiveTo: z.coerce.date().nullable().optional(),

  revisionNotes: z.string().trim().max(4000).nullable().optional(),

})



export const reviseRoutingVersionSchema = z.object({

  revisionNotes: z.string().trim().min(1).max(4000),

})



export const closeRoutingVersionSchema = z.object({

  reason: z.string().trim().min(1).max(4000),

  forceReplace: z.boolean().optional(),

})



export const createStageGroupSchema = z.object({

  code: z.string().trim().min(1).max(32),

  name: z.string().trim().min(1).max(200),

  description: z.string().trim().max(2000).optional(),

  displayOrder: z.coerce.number().int().min(0),

  defaultWorkCentreId: z.string().uuid().nullable().optional(),

  isOptional: z.boolean().default(false),

  parallelAllowed: z.boolean().default(false),

  qualityRequired: z.boolean().default(false),

  completionRule: z.enum(STAGE_COMPLETION_RULE_VALUES).default('ALL_OPERATIONS'),

  isActive: z.boolean().default(true),

  sourceBomLineId: z.string().uuid().nullable().optional(),

})



export const updateStageGroupSchema = createStageGroupSchema.partial()



export const generateStagesFromBomSchema = z.object({

  replaceExisting: z.boolean().default(false),

})



const operationBaseSchema = z.object({

  stageGroupId: z.string().uuid().optional(),

  code: z.string().trim().min(1).max(32),

  name: z.string().trim().min(1).max(200),

  sequence: z.coerce.number().int().positive(),

  description: z.string().trim().max(2000).optional(),

  workCentreId: z.string().uuid(),

  defaultMachineId: z.string().uuid().nullable().optional(),

  setupTimeMinutes: z.coerce.number().min(0).optional(),

  setupTimeValue: z.coerce.number().min(0).optional(),

  setupTimeUnit: z.enum(TIME_UNIT_VALUES).default('MINUTE'),

  runTimeValue: z.coerce.number().min(0).default(0),

  runTimeUnit: z.enum(TIME_UNIT_VALUES).default('MINUTE'),

  runTimeBasis: z.enum(RUN_TIME_BASIS_VALUES).default('PER_UNIT'),

  workInstructions: z.string().trim().max(4000).optional(),

  drawingReference: z.string().trim().max(64).optional(),

  inputType: z.enum(IO_TYPE_VALUES).default('MATERIAL'),

  outputType: z.enum(IO_TYPE_VALUES).default('NONE'),

  outputItemId: z.string().uuid().nullable().optional(),

  qualityRequired: z.boolean().default(false),

  qualityPlanRef: z.string().trim().max(64).optional(),

  qcTestGroupId: z.string().uuid().nullable().optional(),

  outsourced: z.boolean().default(false),

  defaultVendorId: z.string().uuid().nullable().optional(),

  isOptional: z.boolean().default(false),

  isConditional: z.boolean().default(false),

  conditionExpression: z.string().trim().max(2000).optional(),

  reworkAllowed: z.boolean().default(true),

  isActive: z.boolean().default(true),

})



export const createOperationSchema = operationBaseSchema.superRefine((data, ctx) => {

  if (data.qualityRequired && !data.qcTestGroupId) {

    ctx.addIssue({

      code: 'custom',

      message: 'qcTestGroupId is required when qualityRequired is true',

      path: ['qcTestGroupId'],

    })

  }

})



export const updateOperationSchema = operationBaseSchema.partial().superRefine((data, ctx) => {

  if (data.qualityRequired === true && data.qcTestGroupId === undefined) {

    ctx.addIssue({

      code: 'custom',

      message: 'qcTestGroupId is required when qualityRequired is true',

      path: ['qcTestGroupId'],

    })

  }

})



export const createDependencySchema = z.object({

  predecessorOperationId: z.string().uuid(),

  successorOperationId: z.string().uuid(),

  dependencyType: z.enum(DEPENDENCY_TYPE_VALUES).default('FINISH_TO_START'),

  minimumCompletionPercent: z.coerce.number().min(0).max(100).default(100),

  isMandatory: z.boolean().default(true),

  allowParallel: z.boolean().default(false),

})



export const compareRoutingVersionsQuerySchema = z.object({

  from: z.string().uuid().optional(),

  to: z.string().uuid(),

})



export type ListRoutingsQuery = z.infer<typeof listRoutingsQuerySchema>

export type CreateRoutingInput = z.infer<typeof createRoutingSchema>

export type UpdateRoutingInput = z.infer<typeof updateRoutingSchema>

export type ListRoutingVersionsQuery = z.infer<typeof listRoutingVersionsQuerySchema>

export type CreateRoutingVersionInput = z.infer<typeof createRoutingVersionSchema>

export type UpdateRoutingVersionInput = z.infer<typeof updateRoutingVersionSchema>

export type ReviseRoutingVersionInput = z.infer<typeof reviseRoutingVersionSchema>

export type CloseRoutingVersionInput = z.infer<typeof closeRoutingVersionSchema>

export type CreateStageGroupInput = z.infer<typeof createStageGroupSchema>

export type UpdateStageGroupInput = z.infer<typeof updateStageGroupSchema>

export type CreateOperationInput = z.infer<typeof createOperationSchema>

export type UpdateOperationInput = z.infer<typeof updateOperationSchema>

export type CreateDependencyInput = z.infer<typeof createDependencySchema>

export type CompareRoutingVersionsQuery = z.infer<typeof compareRoutingVersionsQuerySchema>

export type GenerateStagesFromBomInput = z.infer<typeof generateStagesFromBomSchema>

