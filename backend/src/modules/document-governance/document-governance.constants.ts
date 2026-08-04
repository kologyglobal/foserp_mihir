/** Feature flag name — env DOCUMENT_GOVERNANCE_DATE_CONTROL (default OFF). */
export const DOCUMENT_GOVERNANCE_DATE_CONTROL_FLAG = 'DOCUMENT_GOVERNANCE_DATE_CONTROL'

export const DATE_POLICY_MODES = [
  'CURRENT_BEHAVIOUR',
  'ALLOW',
  'BLOCK',
  'REQUIRE_APPROVAL',
] as const

export type DatePolicyMode = (typeof DATE_POLICY_MODES)[number]

export const ALLOWANCE_KINDS = [
  'ALLOWED_ROLE',
  'ALLOWED_USER',
  'APPROVER_ROLE',
  'OVERRIDE_ROLE',
] as const

export type AllowanceKind = (typeof ALLOWANCE_KINDS)[number]

export const PROFILE_CODES = ['STRICT', 'STANDARD', 'RELAXED', 'CUSTOM'] as const

export const EXCEPTION_REQUEST_TYPES = ['FUTURE_DATE', 'BACK_DATE'] as const
export const EXCEPTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const

export const AUDIT_MODULE = 'document_governance'
export const AUDIT_ENTITY_POLICY = 'DocumentDatePolicy'
export const AUDIT_ENTITY_PROFILE = 'DocumentDatePolicyProfile'
