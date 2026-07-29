import { prisma } from '../../config/prisma.js'
import { createAuditLog } from '../../services/audit.service.js'
import { ValidationError } from '../../utils/errors.js'
import {
  ADMIN_AUDIT_MODULES,
  MAX_FAILED_LOGINS,
  PASSWORD_MIN_LENGTH,
} from './security.constants.js'
import type { UpdateSecurityPolicyInput } from './security.validation.js'

export type MfaMode = 'off' | 'optional' | 'required'

export interface TenantSecurityPolicy {
  passwordMinLength: number
  maxFailedLogins: number
  requireComplexity: boolean
  mfaMode: MfaMode
  /** TOTP enrollment not shipped — required mode is rejected on update. */
  mfaEnrollmentAvailable: false
  mfa: 'not_configured' | 'off' | 'optional' | 'required'
  adminAuditModules: string[]
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

const MFA_MODES: MfaMode[] = ['off', 'optional', 'required']

function toPolicy(row: {
  passwordMinLength: number
  maxFailedLogins: number
  requireComplexity: boolean
  mfaMode: string
}): TenantSecurityPolicy {
  const mfaMode = (MFA_MODES.includes(row.mfaMode as MfaMode) ? row.mfaMode : 'off') as MfaMode
  return {
    passwordMinLength: row.passwordMinLength,
    maxFailedLogins: row.maxFailedLogins,
    requireComplexity: row.requireComplexity,
    mfaMode,
    mfaEnrollmentAvailable: false,
    mfa: mfaMode === 'off' ? 'not_configured' : mfaMode,
    adminAuditModules: [...ADMIN_AUDIT_MODULES],
  }
}

export async function getOrCreateSecuritySettings(tenantId: string) {
  const existing = await prisma.tenantSecuritySettings.findUnique({ where: { tenantId } })
  if (existing) return existing
  return prisma.tenantSecuritySettings.create({
    data: {
      tenantId,
      passwordMinLength: PASSWORD_MIN_LENGTH,
      maxFailedLogins: MAX_FAILED_LOGINS,
      requireComplexity: false,
      mfaMode: 'off',
    },
  })
}

export async function getSecurityPolicy(tenantId: string): Promise<TenantSecurityPolicy> {
  const row = await getOrCreateSecuritySettings(tenantId)
  return toPolicy(row)
}

export async function updateSecurityPolicy(
  tenantId: string,
  input: UpdateSecurityPolicyInput,
  audit?: AuditMeta,
): Promise<TenantSecurityPolicy> {
  if (input.mfaMode === 'required') {
    throw new ValidationError(
      'MFA required mode is not available until user MFA enrollment ships — use off or optional',
    )
  }

  const before = await getOrCreateSecuritySettings(tenantId)
  const updated = await prisma.tenantSecuritySettings.update({
    where: { tenantId },
    data: {
      ...(input.passwordMinLength !== undefined ? { passwordMinLength: input.passwordMinLength } : {}),
      ...(input.maxFailedLogins !== undefined ? { maxFailedLogins: input.maxFailedLogins } : {}),
      ...(input.requireComplexity !== undefined ? { requireComplexity: input.requireComplexity } : {}),
      ...(input.mfaMode !== undefined ? { mfaMode: input.mfaMode } : {}),
      updatedBy: audit?.userId,
    },
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'security',
    entity: 'TenantSecuritySettings',
    entityId: updated.id,
    action: 'UPDATE_POLICY',
    oldValues: {
      passwordMinLength: before.passwordMinLength,
      maxFailedLogins: before.maxFailedLogins,
      requireComplexity: before.requireComplexity,
      mfaMode: before.mfaMode,
    },
    newValues: {
      passwordMinLength: updated.passwordMinLength,
      maxFailedLogins: updated.maxFailedLogins,
      requireComplexity: updated.requireComplexity,
      mfaMode: updated.mfaMode,
    },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return toPolicy(updated)
}

/** Enforce tenant password policy after Zod floor checks. */
export async function assertPasswordMeetsPolicy(tenantId: string, password: string): Promise<void> {
  const policy = await getSecurityPolicy(tenantId)
  if (password.length < policy.passwordMinLength) {
    throw new ValidationError(`Password must be at least ${policy.passwordMinLength} characters`)
  }
  if (policy.requireComplexity) {
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasDigit = /\d/.test(password)
    if (!hasUpper || !hasLower || !hasDigit) {
      throw new ValidationError('Password must include upper, lower, and a digit')
    }
  }
}
