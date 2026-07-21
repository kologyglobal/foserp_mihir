import { z } from 'zod'

export const updateBankReconciliationProfileSchema = z
  .object({
    dateBasis: z.enum(['TRANSACTION_DATE', 'VALUE_DATE']).optional(),
    autoMatchEnabled: z.boolean().optional(),
    autoMatchToleranceAmount: z.coerce.number().min(0).optional(),
    autoMatchToleranceDays: z.coerce.number().int().min(0).optional(),
    requireApprovalForMatch: z.boolean().optional(),
    duplicatePolicy: z.enum(['BLOCK', 'WARN', 'ALLOW_WITH_REVIEW']).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    // Phase 5A3 — matching settings.
    dateToleranceDays: z.coerce.number().int().min(0).max(365).optional(),
    referenceNormalizationEnabled: z.boolean().optional(),
    amountTolerance: z.coerce.number().min(0).optional(),
    minimumSuggestionScore: z.coerce.number().int().min(0).max(100).optional(),
    autoReconcileScore: z.coerce.number().int().min(0).max(100).optional(),
    autoReconcileEnabled: z.boolean().optional(),
    groupedSuggestionsEnabled: z.boolean().optional(),
    partialSuggestionsEnabled: z.boolean().optional(),
    maximumGroupSize: z.coerce.number().int().min(1).max(50).optional(),
    requireUniqueExactMatch: z.boolean().optional(),
    allowManualPartialMatch: z.boolean().optional(),
    allowManualGroupedMatch: z.boolean().optional(),
    requireFullMatchToFinalize: z.boolean().optional(),
    allowFinalizeWithExceptions: z.boolean().optional(),
    finalizationDifferenceTolerance: z.coerce.number().min(0).optional(),
    /** Required only when a profile already exists (optimistic concurrency on update). */
    expectedUpdatedAt: z.string().datetime().optional(),
    // Explicitly rejected — these are written only by the (future) reconciliation execution phase.
    lastReconciledDate: z.never({ message: 'lastReconciledDate is read-only from this endpoint' }).optional(),
    lastReconciledBalance: z.never({ message: 'lastReconciledBalance is read-only from this endpoint' }).optional(),
    lastReconciledAt: z.never({ message: 'lastReconciledAt is read-only from this endpoint' }).optional(),
    lastReconciledBy: z.never({ message: 'lastReconciledBy is read-only from this endpoint' }).optional(),
  })
  .strict()

export type UpdateBankReconciliationProfileInput = z.infer<typeof updateBankReconciliationProfileSchema>
