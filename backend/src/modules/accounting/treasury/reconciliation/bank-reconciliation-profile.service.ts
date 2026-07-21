import type { BankReconciliationProfile } from '@prisma/client'
import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { ValidationError } from '../../../../utils/errors.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { BankReconciliationProfileBankOnlyError } from '../treasury.errors.js'
import { getTreasuryAccount } from '../accounts/treasury-account.repository.js'
import * as repo from './bank-reconciliation-profile.repository.js'
import type { UpdateBankReconciliationProfileInput } from './bank-reconciliation-profile.schemas.js'

async function assertBankAccount(tenantId: string, treasuryAccountId: string) {
  const account = await getTreasuryAccount(tenantId, treasuryAccountId)
  if (account.accountType !== 'BANK') throw new BankReconciliationProfileBankOnlyError()
  return account
}

/** Fixed 4-decimal string formatting for consistency with the rest of the finance API. */
function serializeProfile(profile: BankReconciliationProfile) {
  return {
    ...profile,
    autoMatchToleranceAmount: formatForPersistence(profile.autoMatchToleranceAmount),
    lastReconciledBalance: profile.lastReconciledBalance != null ? formatForPersistence(profile.lastReconciledBalance) : null,
    amountTolerance: formatForPersistence(profile.amountTolerance),
    finalizationDifferenceTolerance: formatForPersistence(profile.finalizationDifferenceTolerance),
  }
}

export async function getRecord(tenantId: string, treasuryAccountId: string) {
  await assertBankAccount(tenantId, treasuryAccountId)
  const profile = await repo.getProfileOrThrow(tenantId, treasuryAccountId)
  return serializeProfile(profile)
}

export async function upsertRecord(
  req: Request,
  tenantId: string,
  treasuryAccountId: string,
  input: UpdateBankReconciliationProfileInput,
) {
  const audit = auditFromRequest(req)
  const userId = req.context?.userId ?? null
  const account = await assertBankAccount(tenantId, treasuryAccountId)

  const existing = await repo.findProfile(tenantId, treasuryAccountId)
  if (existing && !input.expectedUpdatedAt) {
    throw new ValidationError('expectedUpdatedAt is required when updating an existing reconciliation profile')
  }
  const record = existing
    ? await repo.updateProfile(
        tenantId,
        treasuryAccountId,
        {
          tenantId,
          legalEntityId: account.legalEntityId,
          treasuryAccountId,
          dateBasis: input.dateBasis,
          autoMatchEnabled: input.autoMatchEnabled,
          autoMatchToleranceAmount: input.autoMatchToleranceAmount,
          autoMatchToleranceDays: input.autoMatchToleranceDays,
          requireApprovalForMatch: input.requireApprovalForMatch,
          duplicatePolicy: input.duplicatePolicy,
          notes: input.notes,
          dateToleranceDays: input.dateToleranceDays,
          referenceNormalizationEnabled: input.referenceNormalizationEnabled,
          amountTolerance: input.amountTolerance,
          minimumSuggestionScore: input.minimumSuggestionScore,
          autoReconcileScore: input.autoReconcileScore,
          autoReconcileEnabled: input.autoReconcileEnabled,
          groupedSuggestionsEnabled: input.groupedSuggestionsEnabled,
          partialSuggestionsEnabled: input.partialSuggestionsEnabled,
          maximumGroupSize: input.maximumGroupSize,
          requireUniqueExactMatch: input.requireUniqueExactMatch,
          allowManualPartialMatch: input.allowManualPartialMatch,
          allowManualGroupedMatch: input.allowManualGroupedMatch,
          requireFullMatchToFinalize: input.requireFullMatchToFinalize,
          allowFinalizeWithExceptions: input.allowFinalizeWithExceptions,
          finalizationDifferenceTolerance: input.finalizationDifferenceTolerance,
          userId,
        },
        input.expectedUpdatedAt as string,
      )
    : await repo.createProfile({
        tenantId,
        legalEntityId: account.legalEntityId,
        treasuryAccountId,
        dateBasis: input.dateBasis,
        autoMatchEnabled: input.autoMatchEnabled,
        autoMatchToleranceAmount: input.autoMatchToleranceAmount,
        autoMatchToleranceDays: input.autoMatchToleranceDays,
        requireApprovalForMatch: input.requireApprovalForMatch,
        duplicatePolicy: input.duplicatePolicy,
        notes: input.notes,
        dateToleranceDays: input.dateToleranceDays,
        referenceNormalizationEnabled: input.referenceNormalizationEnabled,
        amountTolerance: input.amountTolerance,
        minimumSuggestionScore: input.minimumSuggestionScore,
        autoReconcileScore: input.autoReconcileScore,
        autoReconcileEnabled: input.autoReconcileEnabled,
        groupedSuggestionsEnabled: input.groupedSuggestionsEnabled,
        partialSuggestionsEnabled: input.partialSuggestionsEnabled,
        maximumGroupSize: input.maximumGroupSize,
        requireUniqueExactMatch: input.requireUniqueExactMatch,
        allowManualPartialMatch: input.allowManualPartialMatch,
        allowManualGroupedMatch: input.allowManualGroupedMatch,
        requireFullMatchToFinalize: input.requireFullMatchToFinalize,
        allowFinalizeWithExceptions: input.allowFinalizeWithExceptions,
        finalizationDifferenceTolerance: input.finalizationDifferenceTolerance,
        userId,
      })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_reconciliation_profile',
    entityId: treasuryAccountId,
    action: existing ? 'UPDATE' : 'CREATE',
    oldValues: existing ?? undefined,
    newValues: record,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serializeProfile(record)
}
