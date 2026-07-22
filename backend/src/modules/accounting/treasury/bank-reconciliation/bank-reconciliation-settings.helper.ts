import { formatForPersistence } from '../../shared/finance-decimal.js'
import * as profileRepo from '../reconciliation/bank-reconciliation-profile.repository.js'

export interface EffectiveMatchingSettings {
  dateToleranceDays: number
  amountTolerance: string
  referenceNormalizationEnabled: boolean
  minimumSuggestionScore: number
  autoReconcileScore: number
  autoReconcileEnabled: boolean
  groupedSuggestionsEnabled: boolean
  partialSuggestionsEnabled: boolean
  maximumGroupSize: number
  requireUniqueExactMatch: boolean
  allowManualPartialMatch: boolean
  allowManualGroupedMatch: boolean
  requireFullMatchToFinalize: boolean
  allowFinalizeWithExceptions: boolean
  finalizationDifferenceTolerance: string
}

const DEFAULTS: EffectiveMatchingSettings = {
  dateToleranceDays: 3,
  amountTolerance: '0.0000',
  referenceNormalizationEnabled: true,
  minimumSuggestionScore: 65,
  autoReconcileScore: 95,
  autoReconcileEnabled: false,
  groupedSuggestionsEnabled: true,
  partialSuggestionsEnabled: false,
  maximumGroupSize: 5,
  requireUniqueExactMatch: true,
  allowManualPartialMatch: true,
  allowManualGroupedMatch: true,
  requireFullMatchToFinalize: true,
  allowFinalizeWithExceptions: false,
  finalizationDifferenceTolerance: '0.0000',
}

export async function getEffectiveMatchingSettings(
  tenantId: string,
  treasuryAccountId: string,
): Promise<EffectiveMatchingSettings> {
  const profile = await profileRepo.findProfile(tenantId, treasuryAccountId)
  if (!profile) return { ...DEFAULTS }
  return {
    dateToleranceDays: profile.dateToleranceDays,
    amountTolerance: formatForPersistence(profile.amountTolerance),
    referenceNormalizationEnabled: profile.referenceNormalizationEnabled,
    minimumSuggestionScore: profile.minimumSuggestionScore,
    autoReconcileScore: profile.autoReconcileScore,
    autoReconcileEnabled: profile.autoReconcileEnabled,
    groupedSuggestionsEnabled: profile.groupedSuggestionsEnabled,
    partialSuggestionsEnabled: profile.partialSuggestionsEnabled,
    maximumGroupSize: profile.maximumGroupSize,
    requireUniqueExactMatch: profile.requireUniqueExactMatch,
    allowManualPartialMatch: profile.allowManualPartialMatch,
    allowManualGroupedMatch: profile.allowManualGroupedMatch,
    requireFullMatchToFinalize: profile.requireFullMatchToFinalize,
    allowFinalizeWithExceptions: profile.allowFinalizeWithExceptions,
    finalizationDifferenceTolerance: formatForPersistence(profile.finalizationDifferenceTolerance),
  }
}
