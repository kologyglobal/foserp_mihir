import type { DocumentDatePolicy } from '@prisma/client'
import type { DatePolicyMode } from './document-governance.constants.js'
import type {
  DocumentDatePolicyEvaluation,
  EffectiveDocumentDatePolicy,
  EvaluateDocumentDatePolicyInput,
  GetDocumentDatePolicyInput,
} from './document-date-policy.types.js'
import { isDocumentGovernanceDateControlEnabled } from './feature-flag.js'

function toDateOnly(value: Date | string): Date {
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime())
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function asMode(value: string): DatePolicyMode {
  if (
    value === 'ALLOW' ||
    value === 'BLOCK' ||
    value === 'REQUIRE_APPROVAL' ||
    value === 'CURRENT_BEHAVIOUR'
  ) {
    return value
  }
  return 'CURRENT_BEHAVIOUR'
}

function isEffectiveForBusinessDate(
  policy: Pick<DocumentDatePolicy, 'effectiveFrom' | 'effectiveTo'>,
  businessDate: Date | null,
): boolean {
  if (!businessDate) return true
  if (policy.effectiveFrom) {
    if (toDateOnly(policy.effectiveFrom).getTime() > businessDate.getTime()) return false
  }
  if (policy.effectiveTo) {
    if (toDateOnly(policy.effectiveTo).getTime() < businessDate.getTime()) return false
  }
  return true
}

/**
 * Score scope specificity: branch > LE > tenant-wide.
 */
export function scorePolicyScope(
  policy: Pick<DocumentDatePolicy, 'legalEntityId' | 'branchId'>,
  legalEntityId?: string | null,
  branchId?: string | null,
): number | null {
  if (policy.branchId) {
    if (!branchId || policy.branchId !== branchId) return null
    if (policy.legalEntityId && legalEntityId && policy.legalEntityId !== legalEntityId) return null
    return 300
  }
  if (policy.legalEntityId) {
    if (!legalEntityId || policy.legalEntityId !== legalEntityId) return null
    return 200
  }
  return 100
}

export function mapRowToEffective(
  row: DocumentDatePolicy | null,
  input: GetDocumentDatePolicyInput,
  featureFlagEnabled: boolean,
): EffectiveDocumentDatePolicy {
  const base: EffectiveDocumentDatePolicy = {
    id: null,
    tenantId: input.tenantId,
    legalEntityId: input.legalEntityId ?? null,
    branchId: input.branchId ?? null,
    moduleKey: input.moduleKey,
    documentType: input.documentType,
    policyEnabled: false,
    futureDateMode: 'CURRENT_BEHAVIOUR',
    pastDateMode: 'CURRENT_BEHAVIOUR',
    maxFutureDays: null,
    maxBackDateDays: null,
    approvalRequired: false,
    allowEmergencyOverride: false,
    policyProfile: null,
    profileId: null,
    effectiveFrom: null,
    effectiveTo: null,
    active: false,
    scope: 'NONE',
    featureFlagEnabled,
  }
  if (!row) return base

  let scope: EffectiveDocumentDatePolicy['scope'] = 'TENANT'
  if (row.branchId) scope = 'BRANCH'
  else if (row.legalEntityId) scope = 'LEGAL_ENTITY'

  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    branchId: row.branchId,
    moduleKey: row.moduleKey,
    documentType: row.documentType,
    policyEnabled: row.policyEnabled,
    futureDateMode: asMode(row.futureDateMode),
    pastDateMode: asMode(row.pastDateMode),
    maxFutureDays: row.maxFutureDays,
    maxBackDateDays: row.maxBackDateDays,
    approvalRequired: row.approvalRequired,
    allowEmergencyOverride: row.allowEmergencyOverride,
    policyProfile: row.policyProfile,
    profileId: row.profileId,
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString() : null,
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    active: row.active,
    scope,
    featureFlagEnabled,
  }
}

/**
 * Pure evaluation — used by unit tests and future module wiring.
 * When feature flag OFF or policyEnabled false or modes CURRENT_BEHAVIOUR → currentBehavior.
 */
export function evaluateDocumentDatePolicy(
  input: EvaluateDocumentDatePolicyInput,
): DocumentDatePolicyEvaluation {
  const { policy } = input
  const documentDate = toDateOnly(input.documentDate)
  const businessDate = toDateOnly(input.businessDate)

  const currentBehaviorResult = (): DocumentDatePolicyEvaluation => ({
    currentBehavior: true,
    allowed: true,
    requiresApproval: false,
    blocked: false,
    reasonCode: null,
    maxAllowedDate: null,
    minAllowedDate: null,
    overrideAvailable: false,
  })

  if (!policy.featureFlagEnabled || !policy.policyEnabled || !policy.active) {
    return currentBehaviorResult()
  }

  const futureMode = policy.futureDateMode
  const pastMode = policy.pastDateMode
  if (futureMode === 'CURRENT_BEHAVIOUR' && pastMode === 'CURRENT_BEHAVIOUR') {
    return currentBehaviorResult()
  }

  let maxAllowedDate: Date | null = null
  let minAllowedDate: Date | null = null
  if (policy.maxFutureDays != null && policy.maxFutureDays >= 0) {
    maxAllowedDate = addDays(businessDate, policy.maxFutureDays)
  }
  if (policy.maxBackDateDays != null && policy.maxBackDateDays >= 0) {
    minAllowedDate = addDays(businessDate, -policy.maxBackDateDays)
  }

  const isFuture = documentDate.getTime() > businessDate.getTime()
  const isPast = documentDate.getTime() < businessDate.getTime()
  const isSame = documentDate.getTime() === businessDate.getTime()

  if (isSame) {
    return {
      currentBehavior: false,
      allowed: true,
      requiresApproval: false,
      blocked: false,
      reasonCode: null,
      maxAllowedDate: maxAllowedDate ? isoDate(maxAllowedDate) : null,
      minAllowedDate: minAllowedDate ? isoDate(minAllowedDate) : null,
      overrideAvailable: policy.allowEmergencyOverride,
    }
  }

  // Window check applies when max days set (even if mode is ALLOW).
  if (isFuture && maxAllowedDate && documentDate.getTime() > maxAllowedDate.getTime()) {
    return {
      currentBehavior: false,
      allowed: false,
      requiresApproval: false,
      blocked: true,
      reasonCode: 'MAX_FUTURE_DAYS_EXCEEDED',
      maxAllowedDate: isoDate(maxAllowedDate),
      minAllowedDate: minAllowedDate ? isoDate(minAllowedDate) : null,
      overrideAvailable: policy.allowEmergencyOverride,
    }
  }
  if (isPast && minAllowedDate && documentDate.getTime() < minAllowedDate.getTime()) {
    return {
      currentBehavior: false,
      allowed: false,
      requiresApproval: false,
      blocked: true,
      reasonCode: 'MAX_BACK_DATE_DAYS_EXCEEDED',
      maxAllowedDate: maxAllowedDate ? isoDate(maxAllowedDate) : null,
      minAllowedDate: isoDate(minAllowedDate),
      overrideAvailable: policy.allowEmergencyOverride,
    }
  }

  const mode = isFuture ? futureMode : pastMode
  if (mode === 'CURRENT_BEHAVIOUR') {
    return currentBehaviorResult()
  }
  if (mode === 'ALLOW') {
    return {
      currentBehavior: false,
      allowed: true,
      requiresApproval: Boolean(policy.approvalRequired),
      blocked: false,
      reasonCode: policy.approvalRequired ? 'ALLOW_WITH_APPROVAL_FLAG' : null,
      maxAllowedDate: maxAllowedDate ? isoDate(maxAllowedDate) : null,
      minAllowedDate: minAllowedDate ? isoDate(minAllowedDate) : null,
      overrideAvailable: policy.allowEmergencyOverride,
    }
  }
  if (mode === 'REQUIRE_APPROVAL' || policy.approvalRequired) {
    return {
      currentBehavior: false,
      allowed: false,
      requiresApproval: true,
      blocked: false,
      reasonCode: isFuture ? 'FUTURE_DATE_REQUIRES_APPROVAL' : 'BACK_DATE_REQUIRES_APPROVAL',
      maxAllowedDate: maxAllowedDate ? isoDate(maxAllowedDate) : null,
      minAllowedDate: minAllowedDate ? isoDate(minAllowedDate) : null,
      overrideAvailable: policy.allowEmergencyOverride,
    }
  }
  // BLOCK
  return {
    currentBehavior: false,
    allowed: false,
    requiresApproval: false,
    blocked: true,
    reasonCode: isFuture ? 'FUTURE_DATE_BLOCKED' : 'BACK_DATE_BLOCKED',
    maxAllowedDate: maxAllowedDate ? isoDate(maxAllowedDate) : null,
    minAllowedDate: minAllowedDate ? isoDate(minAllowedDate) : null,
    overrideAvailable: policy.allowEmergencyOverride,
  }
}

/**
 * Resolve best matching policy from a candidate list (caller loads from DB).
 */
export function resolveEffectivePolicyFromCandidates(
  candidates: DocumentDatePolicy[],
  input: GetDocumentDatePolicyInput,
): EffectiveDocumentDatePolicy {
  const featureFlagEnabled = isDocumentGovernanceDateControlEnabled()
  const businessDate = input.businessDate ? toDateOnly(input.businessDate) : null

  let best: DocumentDatePolicy | null = null
  let bestScore = -1
  for (const row of candidates) {
    if (!row.active) continue
    if (!isEffectiveForBusinessDate(row, businessDate)) continue
    const score = scorePolicyScope(row, input.legalEntityId, input.branchId)
    if (score == null) continue
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }

  return mapRowToEffective(best, input, featureFlagEnabled)
}

/** Safe no-op policy shape when nothing configured. */
export function defaultCurrentBehaviourPolicy(
  input: GetDocumentDatePolicyInput,
): EffectiveDocumentDatePolicy {
  return mapRowToEffective(null, input, isDocumentGovernanceDateControlEnabled())
}

export { isEffectiveForBusinessDate, toDateOnly }
