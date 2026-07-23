/** Consecutive failed logins before auto BLOCKED (Phase 8). */
export const MAX_FAILED_LOGINS = 5

/** Password minimum length — mirrors Zod validation on user/invite create (read-only policy). */
export const PASSWORD_MIN_LENGTH = 8

export const LOGIN_ACTIVITY_REASONS = [
  'SUCCESS',
  'INVALID_CREDENTIALS',
  'INACTIVE',
  'BLOCKED',
  'LOCKED_OUT',
] as const

export type LoginActivityReason = (typeof LOGIN_ACTIVITY_REASONS)[number]

/** Modules commonly written by Admin IAM flows — default Audit register filter. */
export const ADMIN_AUDIT_MODULES = [
  'user',
  'role',
  'module',
  'security',
  'department',
  'responsibility',
  'tenant',
  'invitation',
  'scope',
  'access',
] as const
