import type { BankReconciliationProfile } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { BankReconciliationProfileNotFoundError, TreasuryStaleVersionError } from '../treasury.errors.js'

export async function findProfile(tenantId: string, treasuryAccountId: string): Promise<BankReconciliationProfile | null> {
  return prisma.bankReconciliationProfile.findFirst({ where: { tenantId, treasuryAccountId } })
}

export async function getProfileOrThrow(tenantId: string, treasuryAccountId: string): Promise<BankReconciliationProfile> {
  const profile = await findProfile(tenantId, treasuryAccountId)
  if (!profile) throw new BankReconciliationProfileNotFoundError()
  return profile
}

export interface UpsertProfileData {
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  dateBasis?: string
  autoMatchEnabled?: boolean
  autoMatchToleranceAmount?: number
  autoMatchToleranceDays?: number
  requireApprovalForMatch?: boolean
  duplicatePolicy?: string
  notes?: string | null
  // Phase 5A3 — matching settings.
  dateToleranceDays?: number
  referenceNormalizationEnabled?: boolean
  amountTolerance?: number
  minimumSuggestionScore?: number
  autoReconcileScore?: number
  autoReconcileEnabled?: boolean
  groupedSuggestionsEnabled?: boolean
  partialSuggestionsEnabled?: boolean
  maximumGroupSize?: number
  requireUniqueExactMatch?: boolean
  allowManualPartialMatch?: boolean
  allowManualGroupedMatch?: boolean
  requireFullMatchToFinalize?: boolean
  allowFinalizeWithExceptions?: boolean
  finalizationDifferenceTolerance?: number
  userId: string | null
}

export async function createProfile(data: UpsertProfileData): Promise<BankReconciliationProfile> {
  return prisma.bankReconciliationProfile.create({
    data: {
      tenantId: data.tenantId,
      legalEntityId: data.legalEntityId,
      treasuryAccountId: data.treasuryAccountId,
      dateBasis: (data.dateBasis ?? 'TRANSACTION_DATE') as never,
      autoMatchEnabled: data.autoMatchEnabled ?? false,
      autoMatchToleranceAmount: formatForPersistence(data.autoMatchToleranceAmount ?? 0),
      autoMatchToleranceDays: data.autoMatchToleranceDays ?? 0,
      requireApprovalForMatch: data.requireApprovalForMatch ?? true,
      duplicatePolicy: (data.duplicatePolicy ?? 'BLOCK') as never,
      notes: data.notes ?? null,
      dateToleranceDays: data.dateToleranceDays ?? 3,
      referenceNormalizationEnabled: data.referenceNormalizationEnabled ?? true,
      amountTolerance: formatForPersistence(data.amountTolerance ?? 0),
      minimumSuggestionScore: data.minimumSuggestionScore ?? 65,
      autoReconcileScore: data.autoReconcileScore ?? 95,
      autoReconcileEnabled: data.autoReconcileEnabled ?? false,
      groupedSuggestionsEnabled: data.groupedSuggestionsEnabled ?? true,
      partialSuggestionsEnabled: data.partialSuggestionsEnabled ?? false,
      maximumGroupSize: data.maximumGroupSize ?? 5,
      requireUniqueExactMatch: data.requireUniqueExactMatch ?? true,
      allowManualPartialMatch: data.allowManualPartialMatch ?? true,
      allowManualGroupedMatch: data.allowManualGroupedMatch ?? true,
      requireFullMatchToFinalize: data.requireFullMatchToFinalize ?? true,
      allowFinalizeWithExceptions: data.allowFinalizeWithExceptions ?? false,
      finalizationDifferenceTolerance: formatForPersistence(data.finalizationDifferenceTolerance ?? 0),
      createdBy: data.userId,
      updatedBy: data.userId,
    },
  })
}

export async function updateProfile(
  tenantId: string,
  treasuryAccountId: string,
  data: UpsertProfileData,
  expectedUpdatedAt: string,
): Promise<BankReconciliationProfile> {
  const existing = await getProfileOrThrow(tenantId, treasuryAccountId)
  if (existing.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryStaleVersionError()
  }
  return prisma.bankReconciliationProfile.update({
    where: { treasuryAccountId },
    data: {
      dateBasis: data.dateBasis as never,
      autoMatchEnabled: data.autoMatchEnabled,
      autoMatchToleranceAmount:
        data.autoMatchToleranceAmount !== undefined ? formatForPersistence(data.autoMatchToleranceAmount) : undefined,
      autoMatchToleranceDays: data.autoMatchToleranceDays,
      requireApprovalForMatch: data.requireApprovalForMatch,
      duplicatePolicy: data.duplicatePolicy as never,
      notes: data.notes,
      dateToleranceDays: data.dateToleranceDays,
      referenceNormalizationEnabled: data.referenceNormalizationEnabled,
      amountTolerance: data.amountTolerance !== undefined ? formatForPersistence(data.amountTolerance) : undefined,
      minimumSuggestionScore: data.minimumSuggestionScore,
      autoReconcileScore: data.autoReconcileScore,
      autoReconcileEnabled: data.autoReconcileEnabled,
      groupedSuggestionsEnabled: data.groupedSuggestionsEnabled,
      partialSuggestionsEnabled: data.partialSuggestionsEnabled,
      maximumGroupSize: data.maximumGroupSize,
      requireUniqueExactMatch: data.requireUniqueExactMatch,
      allowManualPartialMatch: data.allowManualPartialMatch,
      allowManualGroupedMatch: data.allowManualGroupedMatch,
      requireFullMatchToFinalize: data.requireFullMatchToFinalize,
      allowFinalizeWithExceptions: data.allowFinalizeWithExceptions,
      finalizationDifferenceTolerance:
        data.finalizationDifferenceTolerance !== undefined
          ? formatForPersistence(data.finalizationDifferenceTolerance)
          : undefined,
      updatedBy: data.userId,
    },
  })
}
