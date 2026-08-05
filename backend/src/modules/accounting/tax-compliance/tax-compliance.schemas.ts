import { z } from 'zod'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dateOnlySchema = z
  .string()
  .regex(DATE_RE, 'Must be YYYY-MM-DD')
  .refine((value) => {
    const [y, mo, d] = value.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
}

export const gstExtractQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    search: z.string().trim().max(100).optional(),
    ...paginationFields,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type GstExtractQueryInput = z.infer<typeof gstExtractQuerySchema>

export const gstSummaryQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type GstSummaryQueryInput = z.infer<typeof gstSummaryQuerySchema>

export const gstLedgerQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    returnPeriod: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM')
      .optional(),
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
    direction: z.enum(['OUTWARD', 'INWARD']).optional(),
    ...paginationFields,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type GstLedgerQueryInput = z.infer<typeof gstLedgerQuerySchema>

export const listGstDocumentQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,
    search: z.string().trim().max(100).optional(),
    ...paginationFields,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type ListGstDocumentQueryInput = z.infer<typeof listGstDocumentQuerySchema>

export const generateEInvoiceSchema = z.object({
  salesInvoiceId: z.string().uuid(),
  /** Optional client key for safe retries — same SI + key returns prior GENERATED IRN. */
  idempotencyKey: z.string().trim().min(1).max(100).optional(),
})

export type GenerateEInvoiceInput = z.infer<typeof generateEInvoiceSchema>

export const generateEWayBillSchema = z
  .object({
    sourceType: z.enum(['SALES_INVOICE', 'DELIVERY_CHALLAN']),
    salesInvoiceId: z.string().uuid().optional(),
    deliveryChallanId: z.string().uuid().optional(),
    fromPlace: z.string().trim().min(1).max(200),
    toPlace: z.string().trim().min(1).max(200),
    distanceKm: z.coerce.number().int().min(0).max(20000),
    vehicleNumber: z.string().trim().max(64).optional().nullable(),
    transporterName: z.string().trim().max(200).optional().nullable(),
    transporterId: z.string().trim().max(20).optional().nullable(),
    /** 1 Road · 2 Rail · 3 Air · 4 Ship */
    transportMode: z.enum(['1', '2', '3', '4']).optional().default('1'),
    movementReason: z.string().trim().max(200).optional().nullable(),
    /** Bypass ₹50k threshold — still uses configured provider mode. */
    force: z.boolean().optional().default(false),
    /** Soft: generate without hard Part B vehicle/transporter rules. */
    allowIncompletePartB: z.boolean().optional().default(true),
    idempotencyKey: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'SALES_INVOICE' && !data.salesInvoiceId) {
      ctx.addIssue({ code: 'custom', message: 'salesInvoiceId is required', path: ['salesInvoiceId'] })
    }
    if (data.sourceType === 'DELIVERY_CHALLAN' && !data.deliveryChallanId) {
      ctx.addIssue({
        code: 'custom',
        message: 'deliveryChallanId is required',
        path: ['deliveryChallanId'],
      })
    }
  })

export type GenerateEWayBillInput = z.infer<typeof generateEWayBillSchema>

export const cancelGstDocumentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type CancelGstDocumentInput = z.infer<typeof cancelGstDocumentSchema>

export const updateEWayVehicleSchema = z.object({
  vehicleNumber: z.string().trim().min(1).max(64),
  fromPlace: z.string().trim().max(200).optional().nullable(),
  reasonCode: z.string().trim().max(32).optional().nullable(),
})

export type UpdateEWayVehicleInput = z.infer<typeof updateEWayVehicleSchema>

export const extendEWayBillSchema = z.object({
  extensionHours: z.coerce.number().int().min(1).max(24).default(8),
  reason: z.string().trim().min(3).max(500).optional(),
})

export type ExtendEWayBillInput = z.infer<typeof extendEWayBillSchema>

export const ewayPanelQuerySchema = z
  .object({
    deliveryChallanId: z.string().uuid().optional(),
    outboundDispatchId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.deliveryChallanId && !data.outboundDispatchId) {
      ctx.addIssue({
        code: 'custom',
        message: 'deliveryChallanId or outboundDispatchId is required',
        path: ['deliveryChallanId'],
      })
    }
  })

export type EWayPanelQueryInput = z.infer<typeof ewayPanelQuerySchema>

// ─── Phase 4 — Reverse charge (RCM) register ─────────────────────────────────

export const rcmRegisterQuerySchema = z
  .object({
    legalEntityId: z.string().uuid(),
    returnPeriod: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM')
      .optional(),
    fromDate: dateOnlySchema.optional(),
    toDate: dateOnlySchema.optional(),
    status: z
      .enum(['LIABILITY_POSTED', 'LIABILITY_PAID', 'ITC_RECOGNIZED', 'ITC_NOT_CLAIMABLE', 'VOID'])
      .optional(),
    ...paginationFields,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'fromDate must be <= toDate',
        path: ['fromDate'],
      })
    }
  })

export type RcmRegisterQueryInput = z.infer<typeof rcmRegisterQuerySchema>

export const markRcmLiabilityPaidSchema = z.object({
  liabilityPaidDate: dateOnlySchema,
  liabilityPaymentRef: z.string().trim().max(128).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type MarkRcmLiabilityPaidInput = z.infer<typeof markRcmLiabilityPaidSchema>

export const recognizeRcmItcSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type RecognizeRcmItcInput = z.infer<typeof recognizeRcmItcSchema>

export const markRcmItcNotClaimableSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type MarkRcmItcNotClaimableInput = z.infer<typeof markRcmItcNotClaimableSchema>

// ─── Phase 3 — GSTR-2B / ITC ────────────────────────────────────────────────

const RETURN_PERIOD_RE = /^\d{4}-\d{2}$/

export const gstr2bImportRowSchema = z.object({
  supplierGstin: z.string().trim().min(3).max(20),
  supplierName: z.string().trim().max(300).optional().nullable(),
  invoiceNumber: z.string().trim().min(1).max(128),
  invoiceDate: dateOnlySchema,
  taxableValue: z.coerce.number().finite(),
  cgstAmount: z.coerce.number().finite().default(0),
  sgstAmount: z.coerce.number().finite().default(0),
  igstAmount: z.coerce.number().finite().default(0),
  cessAmount: z.coerce.number().finite().default(0),
  placeOfSupply: z.string().trim().max(100).optional().nullable(),
  documentTypeHint: z.string().trim().max(40).optional().nullable(),
})

export const gstr2bImportBatchSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  source: z.string().trim().max(32).optional().default('FILE'),
  fileName: z.string().trim().max(260).optional().nullable(),
  providerMode: z.string().trim().max(32).optional().default('SIMULATED'),
  importNotes: z.string().trim().max(1000).optional().nullable(),
  rows: z.array(gstr2bImportRowSchema).min(1).max(5000),
})

export type Gstr2bImportBatchInput = z.infer<typeof gstr2bImportBatchSchema>

export const gstr2bListBatchesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
  status: z.enum(['IMPORTED', 'RECONCILING', 'RECONCILED', 'VOID']).optional(),
  ...paginationFields,
})

export type Gstr2bListBatchesQueryInput = z.infer<typeof gstr2bListBatchesQuerySchema>

export const gstr2bListRowsQuerySchema = z.object({
  matchStatus: z
    .enum([
      'UNMATCHED',
      'MATCHED',
      'PARTIAL_MATCH',
      'MISSING_IN_BOOKS',
      'MISSING_IN_2B',
      'VALUE_MISMATCH',
      'TAX_MISMATCH',
      'GSTIN_MISMATCH',
      'DUPLICATE',
      'REVIEW_REQUIRED',
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  ...paginationFields,
})

export type Gstr2bListRowsQueryInput = z.infer<typeof gstr2bListRowsQuerySchema>

export const gstr2bVoidBatchSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type Gstr2bVoidBatchInput = z.infer<typeof gstr2bVoidBatchSchema>

export const gstr2bReconcileBatchSchema = z.object({
  openFollowUps: z.boolean().optional().default(true),
})

export type Gstr2bReconcileBatchInput = z.infer<typeof gstr2bReconcileBatchSchema>

export const gstr2bListFollowUpsQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED']).optional(),
  ...paginationFields,
})

export type Gstr2bListFollowUpsQueryInput = z.infer<typeof gstr2bListFollowUpsQuerySchema>

export const gstr2bUpdateFollowUpSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED']).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
})

export type Gstr2bUpdateFollowUpInput = z.infer<typeof gstr2bUpdateFollowUpSchema>

// ─── Phase 5 — Registers & GSTR-1 / 3B preparation ───────────────────────────

export const gstRegisterQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  kind: z.enum([
    'SALES',
    'PURCHASE',
    'CN_DN',
    'RCM',
    'EXPORT_SEZ',
    'HSN',
    'STATE',
    'LIABILITY',
    'ITC',
    'PAYMENT_SUMMARY',
  ]),
})

export type GstRegisterQueryInput = z.infer<typeof gstRegisterQuerySchema>

export const gstrReturnPeriodQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM').optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})

export type GstrReturnPeriodQueryInput = z.infer<typeof gstrReturnPeriodQuerySchema>

export const gstrReturnPrepQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})

export type GstrReturnPrepQueryInput = z.infer<typeof gstrReturnPrepQuerySchema>

export const gstrReturnTypeParamSchema = z
  .object({
    tenantId: z.string().uuid().optional(),
    tenantSlug: z.string().min(2).max(100).optional(),
    returnType: z.enum(['GSTR1', 'GSTR3B', 'GSTR-1', 'GSTR-3B']),
  })
  .refine((data) => Boolean(data.tenantId ?? data.tenantSlug), {
    message: 'tenantId or tenantSlug is required',
  })

export type GstrReturnTypeParamInput = z.infer<typeof gstrReturnTypeParamSchema>

export const gstrReturnActionBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
})

export type GstrReturnActionBodyInput = z.infer<typeof gstrReturnActionBodySchema>

export const gstrReturnUnlockBodySchema = gstrReturnActionBodySchema.extend({
  reason: z.string().trim().min(3).max(500),
})

export type GstrReturnUnlockBodyInput = z.infer<typeof gstrReturnUnlockBodySchema>

export const gstrReturnMarkFiledBodySchema = gstrReturnActionBodySchema.extend({
  acknowledgmentRef: z.string().trim().min(3).max(100),
  filedOnPortalDate: dateOnlySchema,
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstrReturnMarkFiledBodyInput = z.infer<typeof gstrReturnMarkFiledBodySchema>

// ─── Phase 12 — GSTR portal filing sessions (SIMULATED default) ───────────────

export const gstrFilingListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM').optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  returnType: z.enum(['GSTR1', 'GSTR3B', 'GSTR-1', 'GSTR-3B']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export type GstrFilingListQueryInput = z.infer<typeof gstrFilingListQuerySchema>

export const gstrFilingCreatePackageSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  returnType: z.enum(['GSTR1', 'GSTR3B', 'GSTR-1', 'GSTR-3B']),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  requireChecker: z.boolean().optional().default(false),
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstrFilingCreatePackageInput = z.infer<typeof gstrFilingCreatePackageSchema>

export const gstrFilingCaptureArnSchema = z.object({
  acknowledgmentRef: z.string().trim().min(3).max(100),
  filedOnPortalDate: dateOnlySchema,
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstrFilingCaptureArnInput = z.infer<typeof gstrFilingCaptureArnSchema>

export const gstrFilingMarkFiledSchema = z.object({
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstrFilingMarkFiledInput = z.infer<typeof gstrFilingMarkFiledSchema>

export const gstrFilingCheckerSchema = z.object({
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstrFilingCheckerInput = z.infer<typeof gstrFilingCheckerSchema>

// ─── Phase 8 — GST payment / PMT-06 style challan ──────────────────────────────

export const gstPaymentListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM').optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export type GstPaymentListQueryInput = z.infer<typeof gstPaymentListQuerySchema>

export const gstPaymentProposeSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  interestAmount: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
  lateFeeAmount: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
  roundOffAmount: z.coerce.number().min(-100).max(100).optional().default(0),
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstPaymentProposeInput = z.infer<typeof gstPaymentProposeSchema>

export const gstPaymentPreviewQuerySchema = gstPaymentProposeSchema

export type GstPaymentPreviewQueryInput = z.infer<typeof gstPaymentPreviewQuerySchema>

export const gstPaymentConfirmSchema = z.object({
  paymentDate: dateOnlySchema,
  cpin: z.string().trim().max(64).optional().nullable(),
  challanNumber: z.string().trim().max(64).optional().nullable(),
  bankReference: z.string().trim().max(128).optional().nullable(),
  remarks: z.string().trim().max(1000).optional().nullable(),
})

export type GstPaymentConfirmInput = z.infer<typeof gstPaymentConfirmSchema>

export const gstPaymentPostGlSchema = z.object({
  bankAccountId: z.string().uuid(),
  postingDate: dateOnlySchema.optional(),
})

export type GstPaymentPostGlInput = z.infer<typeof gstPaymentPostGlSchema>

export const gstPaymentVoidSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export type GstPaymentVoidInput = z.infer<typeof gstPaymentVoidSchema>

// ─── Phase 9 — multi-GSTIN ────────────────────────────────────────────────────

export const gstRegistrationListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export type GstRegistrationListQueryInput = z.infer<typeof gstRegistrationListQuerySchema>

export const gstRegistrationUpsertSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  gstin: z.string().trim().min(15).max(20),
  stateCode: z.string().trim().max(8).optional().nullable(),
  registrationType: z.string().trim().max(40).optional(),
  isPrimary: z.boolean().optional(),
  seriesPrefix: z.string().trim().max(32).optional().nullable(),
  placeOfSupplyDefault: z.string().trim().max(100).optional().nullable(),
  effectiveFrom: dateOnlySchema,
  effectiveTo: dateOnlySchema.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export type GstRegistrationUpsertInput = z.infer<typeof gstRegistrationUpsertSchema>

export const gstBranchTransferPolicySchema = z.object({
  legalEntityId: z.string().uuid(),
  policy: z.enum([
    'NOT_CONFIGURED',
    'SAME_GSTIN_STOCK_NO_TAX',
    'CROSS_GSTIN_TAXABLE_SUPPLY',
    'PROHIBITED',
  ]),
})

export type GstBranchTransferPolicyInput = z.infer<typeof gstBranchTransferPolicySchema>

export const gstBranchTransferEvalSchema = z.object({
  legalEntityId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
})

export type GstBranchTransferEvalInput = z.infer<typeof gstBranchTransferEvalSchema>

export const gstIsolationStatusQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE),
})

export type GstIsolationStatusQueryInput = z.infer<typeof gstIsolationStatusQuerySchema>

// ─── Phase 10 — Export / SEZ / LUT ────────────────────────────────────────────

export const gstLutListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})

export type GstLutListQueryInput = z.infer<typeof gstLutListQuerySchema>

export const gstLutUpsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  lutNumber: z.string().trim().min(1).max(64),
  financialYearLabel: z.string().trim().max(16).optional().nullable(),
  validFrom: dateOnlySchema,
  validTo: dateOnlySchema.optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type GstLutUpsertInput = z.infer<typeof gstLutUpsertSchema>

export const gstExportValidateSchema = z.object({
  legalEntityId: z.string().uuid(),
  branchId: z.string().uuid().optional().nullable(),
  taxTreatment: z.enum([
    'EXPORT_WITH_TAX',
    'EXPORT_WITHOUT_TAX',
    'SEZ_WITH_TAX',
    'SEZ_WITHOUT_TAX',
    'REGISTERED',
    'UNREGISTERED',
    'NON_GST',
  ]),
  documentDate: dateOnlySchema,
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  lutId: z.string().uuid().optional().nullable(),
  hardBlock: z.boolean().optional(),
})

export type GstExportValidateInput = z.infer<typeof gstExportValidateSchema>

export const gstExportRegisterQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})

export type GstExportRegisterQueryInput = z.infer<typeof gstExportRegisterQuerySchema>

export const gstExportRefundListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
})

export type GstExportRefundListQueryInput = z.infer<typeof gstExportRefundListQuerySchema>

export const gstExportRefundProposeSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type GstExportRefundProposeInput = z.infer<typeof gstExportRefundProposeSchema>

export const gstExportRefundSubmitSchema = z.object({
  externalArn: z.string().trim().max(64).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type GstExportRefundSubmitInput = z.infer<typeof gstExportRefundSubmitSchema>

// ─── Phase 11 — specials / advances / GST TDS-TCS ─────────────────────────────

export const gstSpecialsNilRegisterQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type GstSpecialsNilRegisterQueryInput = z.infer<typeof gstSpecialsNilRegisterQuerySchema>

export const gstClassifyBodySchema = z.object({
  gstRate: z.coerce.number(),
  reverseCharge: z.boolean().optional(),
  taxCategoryHint: z.string().trim().max(40).optional().nullable(),
  taxTreatment: z.string().trim().max(40).optional().nullable(),
  registrationScheme: z.string().trim().max(40).optional().nullable(),
  partyRegistrationScheme: z.string().trim().max(40).optional().nullable(),
})
export type GstClassifyBodyInput = z.infer<typeof gstClassifyBodySchema>

export const gstJobWorkEvalBodySchema = z.object({
  movement: z.enum(['DISPATCH_TO_JOBWORKER', 'RETURN_FROM_JOBWORKER', 'JOBWORK_INVOICE']),
  processCharges: z.coerce.number().optional(),
  materialsTaxableValue: z.coerce.number().optional(),
})
export type GstJobWorkEvalBodyInput = z.infer<typeof gstJobWorkEvalBodySchema>

export const gstWithholdingListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
  kind: z.enum(['GST_TDS', 'GST_TCS']).optional(),
  status: z.enum(['OPEN', 'PAID', 'ADJUSTED', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type GstWithholdingListQueryInput = z.infer<typeof gstWithholdingListQuerySchema>

export const gstWithholdingCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  kind: z.enum(['GST_TDS', 'GST_TCS']),
  documentDate: dateOnlySchema,
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
  partyName: z.string().trim().min(1).max(300),
  partyGstin: z.string().trim().max(20).optional().nullable(),
  partyId: z.string().uuid().optional().nullable(),
  sourceDocumentType: z.string().trim().max(64).optional().nullable(),
  sourceDocumentId: z.string().uuid().optional().nullable(),
  sourceDocumentNumber: z.string().trim().max(64).optional().nullable(),
  taxableValue: z.coerce.number().min(0),
  isInterstate: z.boolean().default(false),
  ratePct: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstWithholdingCreateInput = z.infer<typeof gstWithholdingCreateSchema>

export const gstWithholdingMarkPaidSchema = z.object({
  paymentRef: z.string().trim().max(128).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstWithholdingMarkPaidInput = z.infer<typeof gstWithholdingMarkPaidSchema>

export const gstWithholdingVoidSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})
export type GstWithholdingVoidInput = z.infer<typeof gstWithholdingVoidSchema>

export const gstAdvanceListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
  status: z.enum(['RECEIVED', 'PARTIALLY_ADJUSTED', 'ADJUSTED', 'CLOSED', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type GstAdvanceListQueryInput = z.infer<typeof gstAdvanceListQuerySchema>

export const gstAdvanceCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  advanceDate: dateOnlySchema,
  returnPeriod: z.string().regex(RETURN_PERIOD_RE).optional(),
  customerName: z.string().trim().min(1).max(300),
  customerGstin: z.string().trim().max(20).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  receiptDocumentType: z.string().trim().max(64).optional().nullable(),
  receiptDocumentId: z.string().uuid().optional().nullable(),
  receiptDocumentNumber: z.string().trim().max(64).optional().nullable(),
  advanceTaxable: z.coerce.number().min(0),
  advanceTax: z.coerce.number().min(0),
  placeOfSupply: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstAdvanceCreateInput = z.infer<typeof gstAdvanceCreateSchema>

export const gstAdvanceAdjustSchema = z.object({
  salesInvoiceId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().trim().max(64).optional().nullable(),
  invoiceDate: dateOnlySchema.optional().nullable(),
  invoiceTaxable: z.coerce.number().min(0),
  invoiceTax: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional().nullable(),
})
export type GstAdvanceAdjustInput = z.infer<typeof gstAdvanceAdjustSchema>

export const gstCompositionGatesQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
})
export type GstCompositionGatesQueryInput = z.infer<typeof gstCompositionGatesQuerySchema>

// ─── Phase 13 — go-live UAT / period readiness ───────────────────────────────

const returnPeriodYm = z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM')

export const gstHardeningPeriodQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: returnPeriodYm,
  companyGstin: z.string().trim().max(20).optional(),
})
export type GstHardeningPeriodQueryInput = z.infer<typeof gstHardeningPeriodQuerySchema>

export const gstGoLiveGateQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().max(20).optional(),
})
export type GstGoLiveGateQueryInput = z.infer<typeof gstGoLiveGateQuerySchema>

export const gstUatSignOffListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().max(20).optional(),
})
export type GstUatSignOffListQueryInput = z.infer<typeof gstUatSignOffListQuerySchema>

const uatAxisCellSchema = z.object({
  passed: z.boolean().optional(),
  evidenceRef: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export const gstUatSignOffCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().max(20).optional().nullable(),
  checklist: z.record(z.string(), uatAxisCellSchema).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstUatSignOffCreateInput = z.infer<typeof gstUatSignOffCreateSchema>

export const gstUatSignOffUpdateSchema = z.object({
  checklist: z.record(z.string(), uatAxisCellSchema),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstUatSignOffUpdateInput = z.infer<typeof gstUatSignOffUpdateSchema>

export const gstUatSignOffRevokeSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})
export type GstUatSignOffRevokeInput = z.infer<typeof gstUatSignOffRevokeSchema>

// ─── Phase 16 — Rate master ops / determination continuity ───────────────────

export const gstRateOpsReportQuerySchema = z.object({
  asOfDate: dateOnlySchema.optional(),
  horizonDays: z.coerce.number().int().min(1).max(180).optional().default(30),
})
export type GstRateOpsReportQueryInput = z.infer<typeof gstRateOpsReportQuerySchema>

export const gstRateOpsDriftQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  tolerancePct: z.coerce.number().min(0).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
})
export type GstRateOpsDriftQueryInput = z.infer<typeof gstRateOpsDriftQuerySchema>

export const gstRateOpsRunCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  tolerancePct: z.coerce.number().min(0).max(5).optional(),
  runKind: z.enum(['COVERAGE', 'DRIFT', 'FULL_REPORT']).optional().default('FULL_REPORT'),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstRateOpsRunCreateInput = z.infer<typeof gstRateOpsRunCreateSchema>

export const gstRateOpsRunListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type GstRateOpsRunListQueryInput = z.infer<typeof gstRateOpsRunListQuerySchema>

export const gstRateOpsAckSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstRateOpsAckInput = z.infer<typeof gstRateOpsAckSchema>

// ─── Phase 17 — Data quality / GSTIN backfill / freeze checklist ─────────────

export const gstDataQualityPeriodQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
})
export type GstDataQualityPeriodQueryInput = z.infer<typeof gstDataQualityPeriodQuerySchema>

export const gstDataQualityBackfillSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(2000),
  confirm: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstDataQualityBackfillInput = z.infer<typeof gstDataQualityBackfillSchema>

export const gstDataQualityRunCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  runKind: z.enum(['SCAN', 'BACKFILL_DRY_RUN', 'FULL_REPORT']).optional().default('FULL_REPORT'),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstDataQualityRunCreateInput = z.infer<typeof gstDataQualityRunCreateSchema>

export const gstDataQualityRunListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type GstDataQualityRunListQueryInput = z.infer<typeof gstDataQualityRunListQuerySchema>

export const gstDataQualityAckSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstDataQualityAckInput = z.infer<typeof gstDataQualityAckSchema>

// ─── Phase 18 — GST subledger vs GL control recon ────────────────────────────

export const gstGlReconQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  tolerance: z.coerce.number().min(0).max(10000).optional().default(1),
})
export type GstGlReconQueryInput = z.infer<typeof gstGlReconQuerySchema>

export const gstGlReconRunCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  tolerance: z.coerce.number().min(0).max(10000).optional().default(1),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstGlReconRunCreateInput = z.infer<typeof gstGlReconRunCreateSchema>

export const gstGlReconRunListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type GstGlReconRunListQueryInput = z.infer<typeof gstGlReconRunListQuerySchema>

export const gstGlReconAckSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstGlReconAckInput = z.infer<typeof gstGlReconAckSchema>

// ─── Phase 14 — Annual / cockpit / FY archive ────────────────────────────────

const FY_RE = /^\d{4}-\d{2}$/

export const gstAnnualListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE).optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  returnType: z.enum(['GSTR9', 'GSTR9C']).optional(),
})
export type GstAnnualListQueryInput = z.infer<typeof gstAnnualListQuerySchema>

export const gstAnnualGetQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE),
  companyGstin: z.string().trim().min(3).max(20).optional(),
  returnType: z.enum(['GSTR9', 'GSTR9C']).optional(),
})
export type GstAnnualGetQueryInput = z.infer<typeof gstAnnualGetQuerySchema>

export const gstAnnualPrepareBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  returnType: z.enum(['GSTR9', 'GSTR9C']).optional(),
  remarks: z.string().trim().max(1000).optional().nullable(),
})
export type GstAnnualPrepareBodyInput = z.infer<typeof gstAnnualPrepareBodySchema>

export const gstAnnualActionBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  returnType: z.enum(['GSTR9', 'GSTR9C']).optional(),
  remarks: z.string().trim().max(1000).optional().nullable(),
})
export type GstAnnualActionBodyInput = z.infer<typeof gstAnnualActionBodySchema>

export const gstAnnualUnlockBodySchema = gstAnnualActionBodySchema.extend({
  reason: z.string().trim().min(1).max(500),
})
export type GstAnnualUnlockBodyInput = z.infer<typeof gstAnnualUnlockBodySchema>

export const gstAnnualMarkFiledBodySchema = gstAnnualActionBodySchema.extend({
  acknowledgmentRef: z.string().trim().min(1).max(100),
  filedOnPortalDate: dateOnlySchema.optional().nullable(),
})
export type GstAnnualMarkFiledBodyInput = z.infer<typeof gstAnnualMarkFiledBodySchema>

export const gstCockpitQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE).optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})
export type GstCockpitQueryInput = z.infer<typeof gstCockpitQuerySchema>

export const gstFyArchiveListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE).optional(),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})
export type GstFyArchiveListQueryInput = z.infer<typeof gstFyArchiveListQuerySchema>

export const gstFyArchiveBodySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYear: z.string().regex(FY_RE),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  retainUntil: dateOnlySchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstFyArchiveBodyInput = z.infer<typeof gstFyArchiveBodySchema>

// ─── Phase 15 — Compliance ops (cockpit / health / audit pack / notices / GSTR-9 foundation) ─

export const gstMultiPeriodHealthQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  periodFrom: z.string().regex(RETURN_PERIOD_RE, 'periodFrom must be yyyy-MM'),
  periodTo: z.string().regex(RETURN_PERIOD_RE, 'periodTo must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})
export type GstMultiPeriodHealthQueryInput = z.infer<typeof gstMultiPeriodHealthQuerySchema>

export const gstComplianceCockpitQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  returnPeriod: z.string().regex(RETURN_PERIOD_RE, 'returnPeriod must be yyyy-MM'),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})
export type GstComplianceCockpitQueryInput = z.infer<typeof gstComplianceCockpitQuerySchema>

export const gstGstr9AnnualQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  financialYearLabel: z.string().trim().min(4).max(16),
  companyGstin: z.string().trim().min(3).max(20).optional(),
})
export type GstGstr9AnnualQueryInput = z.infer<typeof gstGstr9AnnualQuerySchema>

export const gstAuditPackListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: z.enum(['GENERATED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type GstAuditPackListQueryInput = z.infer<typeof gstAuditPackListQuerySchema>

export const gstAuditPackCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  periodFrom: z.string().regex(RETURN_PERIOD_RE),
  periodTo: z.string().regex(RETURN_PERIOD_RE),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  financialYearLabel: z.string().trim().max(16).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstAuditPackCreateInput = z.infer<typeof gstAuditPackCreateSchema>

export const gstAuditPackVoidSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
})
export type GstAuditPackVoidInput = z.infer<typeof gstAuditPackVoidSchema>

export const gstComplianceNoticeListQuerySchema = z.object({
  legalEntityId: z.string().uuid(),
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESPONDED', 'CLOSED', 'VOID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type GstComplianceNoticeListQueryInput = z.infer<typeof gstComplianceNoticeListQuerySchema>

export const gstComplianceNoticeCreateSchema = z.object({
  legalEntityId: z.string().uuid(),
  companyGstin: z.string().trim().min(3).max(20).optional().nullable(),
  noticeRef: z.string().trim().min(1).max(100),
  noticeDate: dateOnlySchema,
  noticeType: z.string().trim().min(1).max(64),
  subject: z.string().trim().min(1).max(500),
  dueDate: dateOnlySchema.optional().nullable(),
  amountDemanded: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstComplianceNoticeCreateInput = z.infer<typeof gstComplianceNoticeCreateSchema>

export const gstComplianceNoticeUpdateSchema = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESPONDED', 'CLOSED', 'VOID']).optional(),
  responseNotes: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type GstComplianceNoticeUpdateInput = z.infer<typeof gstComplianceNoticeUpdateSchema>
