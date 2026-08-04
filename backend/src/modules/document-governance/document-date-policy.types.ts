import type { DatePolicyMode } from './document-governance.constants.js'

export type EffectiveDocumentDatePolicy = {
  id: string | null
  tenantId: string
  legalEntityId: string | null
  branchId: string | null
  moduleKey: string
  documentType: string
  policyEnabled: boolean
  futureDateMode: DatePolicyMode
  pastDateMode: DatePolicyMode
  maxFutureDays: number | null
  maxBackDateDays: number | null
  approvalRequired: boolean
  allowEmergencyOverride: boolean
  policyProfile: string | null
  profileId: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  active: boolean
  scope: 'BRANCH' | 'LEGAL_ENTITY' | 'TENANT' | 'NONE'
  /** When feature flag is OFF or no matching policy — always treat as current behaviour. */
  featureFlagEnabled: boolean
}

export type DocumentDatePolicyEvaluation = {
  currentBehavior: boolean
  allowed: boolean
  requiresApproval: boolean
  blocked: boolean
  reasonCode: string | null
  maxAllowedDate: string | null
  minAllowedDate: string | null
  overrideAvailable: boolean
}

export type GetDocumentDatePolicyInput = {
  tenantId: string
  legalEntityId?: string | null
  branchId?: string | null
  moduleKey: string
  documentType: string
  businessDate?: Date | string | null
}

export type EvaluateDocumentDatePolicyInput = {
  policy: EffectiveDocumentDatePolicy
  documentDate: Date | string
  businessDate: Date | string
  userId?: string | null
  roles?: string[]
}
