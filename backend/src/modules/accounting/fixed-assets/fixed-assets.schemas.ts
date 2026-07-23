import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PERIOD_KEY_RE = /^\d{4}-\d{2}$/

export const dateOnlySchema = z
  .string()
  .regex(DATE_RE, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const [y, mo, d] = value.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

export const periodKeySchema = z
  .string()
  .regex(PERIOD_KEY_RE, 'Must be YYYY-MM')
  .refine((value) => {
    const [, month] = value.split('-').map(Number)
    return month >= 1 && month <= 12
  }, 'Invalid calendar month')

const decimalStringSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid decimal string')

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
}

export const fixedAssetOverviewQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export const listFixedAssetCategoriesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationFields,
})

export const createFixedAssetCategorySchema = z.object({
  legalEntityId: z.string().uuid(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  usefulLifeYears: z.coerce.number().int().min(1).max(100),
  residualPercent: decimalStringSchema.refine((v) => {
    const n = Number(v)
    return n >= 0 && n <= 100
  }, 'residualPercent must be between 0 and 100'),
  assetAccountId: z.string().uuid(),
  accumDepAccountId: z.string().uuid(),
  depExpenseAccountId: z.string().uuid(),
})

export const updateFixedAssetCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    usefulLifeYears: z.coerce.number().int().min(1).max(100).optional(),
    residualPercent: decimalStringSchema
      .refine((v) => {
        const n = Number(v)
        return n >= 0 && n <= 100
      }, 'residualPercent must be between 0 and 100')
      .optional(),
    assetAccountId: z.string().uuid().optional(),
    accumDepAccountId: z.string().uuid().optional(),
    depExpenseAccountId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required')

export const listFixedAssetsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'PENDING_CAPITALIZATION',
      'ACTIVE',
      'IDLE',
      'FULLY_DEPRECIATED',
      'DISPOSED',
      'CANCELLED',
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationFields,
})

export const createFixedAssetSchema = z.object({
  legalEntityId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  acquisitionDate: dateOnlySchema,
  acquisitionCost: decimalStringSchema.refine((v) => Number(v) > 0, 'acquisitionCost must be positive'),
  usefulLifeYears: z.coerce.number().int().min(1).max(100).optional(),
  draftReference: z.string().trim().max(64).optional(),
  location: z.string().trim().max(200).optional(),
  plant: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  custodian: z.string().trim().max(200).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  manufacturer: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  vendorName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
  currencyCode: z.string().trim().max(8).default('INR'),
  status: z.enum(['DRAFT', 'PENDING_CAPITALIZATION']).default('DRAFT'),
})

export const updateFixedAssetSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    categoryId: z.string().uuid().optional(),
    acquisitionDate: dateOnlySchema.optional(),
    acquisitionCost: decimalStringSchema.refine((v) => Number(v) > 0, 'acquisitionCost must be positive').optional(),
    usefulLifeYears: z.coerce.number().int().min(1).max(100).optional(),
    draftReference: z.string().trim().max(64).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    plant: z.string().trim().max(200).nullable().optional(),
    department: z.string().trim().max(200).nullable().optional(),
    custodian: z.string().trim().max(200).nullable().optional(),
    serialNumber: z.string().trim().max(100).nullable().optional(),
    manufacturer: z.string().trim().max(200).nullable().optional(),
    model: z.string().trim().max(200).nullable().optional(),
    vendorName: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(['DRAFT', 'PENDING_CAPITALIZATION']).optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required')

export const capitalizeFixedAssetSchema = z.object({
  postingDate: dateOnlySchema.optional(),
  creditAccountId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
})

export const listDepreciationRunsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: z.enum(['DRAFT', 'PREVIEWED', 'POSTED', 'CANCELLED']).optional(),
  ...paginationFields,
})

export const depreciationPreviewSchema = z.object({
  legalEntityId: z.string().uuid(),
  periodKey: periodKeySchema,
})

export const createDepreciationRunSchema = z.object({
  legalEntityId: z.string().uuid(),
  periodKey: periodKeySchema,
  postingDate: dateOnlySchema.optional(),
})

export const disposeFixedAssetSchema = z
  .object({
    disposalType: z.enum(['SALE', 'SCRAP', 'WRITE_OFF']),
    disposalDate: dateOnlySchema.optional(),
    postingDate: dateOnlySchema.optional(),
    proceeds: decimalStringSchema
      .refine((v) => Number(v) >= 0, 'proceeds must be >= 0')
      .default('0'),
    /** When set and less than acquisition cost, posts a partial dispose (Phase 3). */
    disposeCostAmount: decimalStringSchema
      .refine((v) => Number(v) > 0, 'disposeCostAmount must be positive')
      .optional(),
    proceedsAccountId: z.string().uuid().optional(),
    buyerName: z.string().trim().max(200).optional(),
    reason: z.string().trim().min(1).max(1000),
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    const proceeds = Number(data.proceeds)
    if (proceeds > 0 && !data.proceedsAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'proceedsAccountId is required when proceeds > 0',
        path: ['proceedsAccountId'],
      })
    }
    if (data.disposalType === 'SALE' && proceeds <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SALE disposal requires proceeds > 0',
        path: ['proceeds'],
      })
    }
  })

export const disposePreviewSchema = z.object({
  disposalType: z.enum(['SALE', 'SCRAP', 'WRITE_OFF']),
  proceeds: decimalStringSchema.refine((v) => Number(v) >= 0, 'proceeds must be >= 0').default('0'),
  disposeCostAmount: decimalStringSchema
    .refine((v) => Number(v) > 0, 'disposeCostAmount must be positive')
    .optional(),
})

export const listFixedAssetTransfersQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
  ...paginationFields,
})

export const createFixedAssetTransferSchema = z.object({
  legalEntityId: z.string().uuid(),
  assetId: z.string().uuid(),
  transferDate: dateOnlySchema.optional(),
  toLocation: z.string().trim().max(200).optional(),
  toPlant: z.string().trim().max(200).optional(),
  toDepartment: z.string().trim().max(200).optional(),
  toCustodian: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(1).max(1000),
})

export const completeFixedAssetTransferSchema = z.object({
  expectedUpdatedAt: z.string().datetime().optional(),
  assetExpectedUpdatedAt: z.string().datetime().optional(),
})

// ── Phase FA2 — disposal document workflow ──

export const fixedAssetDisposalStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'REJECTED',
  'READY_TO_POST',
  'POSTED',
  'CANCELLED',
  'REVERSED',
])

export const fixedAssetDisposalTypeSchema = z.enum(['SALE', 'SCRAP', 'WRITE_OFF'])

export const expectedUpdatedAtSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
})

export const listFixedAssetDisposalsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: fixedAssetDisposalStatusSchema.optional(),
  assetId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationFields,
})

const fixedAssetDisposalBaseSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid(),
  disposalType: fixedAssetDisposalTypeSchema,
  disposalDate: dateOnlySchema,
  currencyCode: z.string().trim().min(3).max(8).default('INR'),
  proceeds: decimalStringSchema.refine((v) => Number(v) >= 0, 'proceeds must be >= 0').default('0'),
  proceedsTreasuryAccountId: z.string().uuid().nullable().optional(),
  proceedsAccountId: z.string().uuid().nullable().optional(),
  buyerName: z.string().trim().max(200).nullable().optional(),
  reason: z.string().trim().min(1).max(1000),
  approvalRequiredOverride: z.boolean().optional(),
  gstApplicable: z.boolean().default(false),
  placeOfSupply: z.string().trim().max(8).nullable().optional(),
  partyGstin: z.string().trim().max(15).nullable().optional(),
  cgstAmount: decimalStringSchema.refine((v) => Number(v) >= 0, 'cgstAmount must be >= 0').default('0'),
  sgstAmount: decimalStringSchema.refine((v) => Number(v) >= 0, 'sgstAmount must be >= 0').default('0'),
  igstAmount: decimalStringSchema.refine((v) => Number(v) >= 0, 'igstAmount must be >= 0').default('0'),
  cessAmount: decimalStringSchema.refine((v) => Number(v) >= 0, 'cessAmount must be >= 0').default('0'),
})

interface DisposalRefinementShape {
  disposalType: z.infer<typeof fixedAssetDisposalTypeSchema>
  proceeds: string
  proceedsTreasuryAccountId?: string | null
  proceedsAccountId?: string | null
}

function superRefineDisposal(data: DisposalRefinementShape, ctx: z.RefinementCtx) {
  const proceeds = Number(data.proceeds)
  if (data.disposalType === 'SALE' && proceeds <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['proceeds'], message: 'SALE disposal requires proceeds > 0' })
  }
  if (proceeds > 0 && !data.proceedsTreasuryAccountId && !data.proceedsAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proceedsAccountId'],
      message: 'proceedsAccountId or proceedsTreasuryAccountId is required when proceeds > 0',
    })
  }
}

export const createFixedAssetDisposalSchema = fixedAssetDisposalBaseSchema.superRefine(superRefineDisposal)

export const updateFixedAssetDisposalSchema = fixedAssetDisposalBaseSchema
  .omit({ assetId: true })
  .extend({ expectedUpdatedAt: z.string().datetime() })
  .superRefine(superRefineDisposal)

export const submitFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const approveFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  comments: z.string().trim().max(1000).optional(),
})

export const rejectFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const reviseFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().max(500).optional(),
})

export const markFixedAssetDisposalReadySchema = expectedUpdatedAtSchema

export const cancelFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  reason: z.string().trim().min(1).max(500),
})

export const postFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  postingDate: dateOnlySchema.optional(),
})

export const reverseFixedAssetDisposalSchema = expectedUpdatedAtSchema.extend({
  reversalDate: dateOnlySchema,
  reason: z.string().trim().min(1).max(500),
})

export type FixedAssetDisposalStatusInput = z.infer<typeof fixedAssetDisposalStatusSchema>
export type ListFixedAssetDisposalsQueryInput = z.infer<typeof listFixedAssetDisposalsQuerySchema>
export type CreateFixedAssetDisposalInput = z.infer<typeof createFixedAssetDisposalSchema>
export type UpdateFixedAssetDisposalInput = z.infer<typeof updateFixedAssetDisposalSchema>
export type SubmitFixedAssetDisposalInput = z.infer<typeof submitFixedAssetDisposalSchema>
export type ApproveFixedAssetDisposalInput = z.infer<typeof approveFixedAssetDisposalSchema>
export type RejectFixedAssetDisposalInput = z.infer<typeof rejectFixedAssetDisposalSchema>
export type ReviseFixedAssetDisposalInput = z.infer<typeof reviseFixedAssetDisposalSchema>
export type MarkFixedAssetDisposalReadyInput = z.infer<typeof markFixedAssetDisposalReadySchema>
export type CancelFixedAssetDisposalInput = z.infer<typeof cancelFixedAssetDisposalSchema>
export type PostFixedAssetDisposalInput = z.infer<typeof postFixedAssetDisposalSchema>
export type ReverseFixedAssetDisposalInput = z.infer<typeof reverseFixedAssetDisposalSchema>

export type FixedAssetOverviewQueryInput = z.infer<typeof fixedAssetOverviewQuerySchema>
export type ListFixedAssetCategoriesQueryInput = z.infer<typeof listFixedAssetCategoriesQuerySchema>
export type CreateFixedAssetCategoryInput = z.infer<typeof createFixedAssetCategorySchema>
export type UpdateFixedAssetCategoryInput = z.infer<typeof updateFixedAssetCategorySchema>
export type ListFixedAssetsQueryInput = z.infer<typeof listFixedAssetsQuerySchema>
export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>
export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>
export type CapitalizeFixedAssetInput = z.infer<typeof capitalizeFixedAssetSchema>
export type ListDepreciationRunsQueryInput = z.infer<typeof listDepreciationRunsQuerySchema>
export type DepreciationPreviewInput = z.infer<typeof depreciationPreviewSchema>
export type CreateDepreciationRunInput = z.infer<typeof createDepreciationRunSchema>
export type DisposeFixedAssetInput = z.infer<typeof disposeFixedAssetSchema>
export type DisposePreviewInput = z.infer<typeof disposePreviewSchema>
export type ListFixedAssetTransfersQueryInput = z.infer<typeof listFixedAssetTransfersQuerySchema>
export type CreateFixedAssetTransferInput = z.infer<typeof createFixedAssetTransferSchema>
export type CompleteFixedAssetTransferInput = z.infer<typeof completeFixedAssetTransferSchema>

// ─── Phase 4 — revaluation / impairment / maintenance / reports ──────────────

export const listFixedAssetPhase4QuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  search: z.string().trim().max(100).optional(),
  ...paginationFields,
})

export const createFixedAssetRevaluationSchema = z.object({
  legalEntityId: z.string().uuid(),
  assetId: z.string().uuid(),
  revaluationDate: dateOnlySchema,
  revaluedAmount: decimalStringSchema.refine((v) => Number(v) > 0, 'revaluedAmount must be positive'),
  reason: z.string().trim().min(1).max(1000),
})

export const createFixedAssetImpairmentSchema = z.object({
  legalEntityId: z.string().uuid(),
  assetId: z.string().uuid(),
  impairmentDate: dateOnlySchema,
  recoverableAmount: decimalStringSchema.refine((v) => Number(v) >= 0, 'recoverableAmount cannot be negative'),
  reason: z.string().trim().min(1).max(1000),
})

export const createFixedAssetMaintenanceSchema = z.object({
  legalEntityId: z.string().uuid(),
  assetId: z.string().uuid(),
  maintenanceType: z.enum([
    'Preventive',
    'Breakdown',
    'Calibration',
    'AMC',
    'Inspection',
    'PREVENTIVE',
    'BREAKDOWN',
    'CALIBRATION',
    'INSPECTION',
  ]),
  scheduledDate: dateOnlySchema,
  vendorName: z.string().trim().max(200).optional().nullable(),
  cost: decimalStringSchema.optional(),
  downtimeHours: z.coerce.number().min(0).max(100000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const updateFixedAssetMaintenanceSchema = z
  .object({
    scheduledDate: dateOnlySchema.optional(),
    vendorName: z.string().trim().max(200).optional().nullable(),
    cost: decimalStringSchema.optional(),
    downtimeHours: z.coerce.number().min(0).max(100000).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(['Scheduled', 'In Progress', 'SCHEDULED', 'IN_PROGRESS']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field is required')

export const completeFixedAssetMaintenanceSchema = z.object({
  completedDate: dateOnlySchema.optional(),
})

export const fixedAssetReportQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export type ListFixedAssetPhase4QueryInput = z.infer<typeof listFixedAssetPhase4QuerySchema>
export type CreateFixedAssetRevaluationInput = z.infer<typeof createFixedAssetRevaluationSchema>
export type CreateFixedAssetImpairmentInput = z.infer<typeof createFixedAssetImpairmentSchema>
export type CreateFixedAssetMaintenanceInput = z.infer<typeof createFixedAssetMaintenanceSchema>
export type UpdateFixedAssetMaintenanceInput = z.infer<typeof updateFixedAssetMaintenanceSchema>
export type CompleteFixedAssetMaintenanceInput = z.infer<typeof completeFixedAssetMaintenanceSchema>
export type FixedAssetReportQueryInput = z.infer<typeof fixedAssetReportQuerySchema>
