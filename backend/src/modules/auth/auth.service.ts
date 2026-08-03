import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import {
  AuthenticationError,
  AuthorizationError,
  InvalidStateError,
  NotFoundError,
} from '../../utils/errors.js'
import {
  parseExpiresInMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js'
import { hashPassword, hashToken, verifyPassword, verifyTokenHash } from '../../utils/password.js'
import {
  AUTH_CODE,
  AUTH_MSG,
  LOGIN_LOCKOUT_MS,
  LOGIN_LOCKOUT_THRESHOLD,
} from './auth.messages.js'
import type {
  AcceptInvitationInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginDirectoryQuery,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from './auth.validation.js'
import { MAX_FAILED_LOGINS, type LoginActivityReason } from '../security/security.constants.js'
import { assertPasswordMeetsPolicy, getSecurityPolicy } from '../security/security-policy.service.js'
import { isMailConfigured, sendPasswordResetEmail } from '../../services/mail.service.js'

export interface UserPermissions {
  roles: string[]
  permissions: string[]
}

export interface AuthUser {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  mobile: string | null
  designation: string | null
  department: string | null
  status: string
  emailVerified: boolean
  lastLoginAt: Date | null
  roles: string[]
  permissions: string[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResult extends AuthTokens {
  user: AuthUser
}

const userSelect = {
  id: true,
  tenantId: true,
  firstName: true,
  lastName: true,
  email: true,
  mobile: true,
  designation: true,
  department: true,
  status: true,
  emailVerified: true,
  lastLoginAt: true,
  failedLoginCount: true,
  lockedAt: true,
  passwordHash: true,
  failedLoginAttempts: true,
  lockedUntil: true,
} as const

export async function loadUserPermissions(userId: string, tenantId: string): Promise<UserPermissions> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId, tenantId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  })

  const roles = userRoles.map((ur) => ur.role.name)
  const permissions = [
    ...new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.name))),
  ]

  return { roles, permissions }
}

async function issueTokens(
  userId: string,
  tenantId: string,
  userAgent?: string | null,
  ipAddress?: string | null,
): Promise<AuthTokens> {
  const jti = uuidv4()
  const refreshToken = signRefreshToken({ sub: userId, tenantId, jti })
  const tokenHash = await hashToken(refreshToken)
  const expiresAt = new Date(Date.now() + parseExpiresInMs(env.JWT_REFRESH_EXPIRES_IN))

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      tenantId,
      tokenHash,
      expiresAt,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    },
  })

  const accessToken = signAccessToken({ sub: userId, tenantId })

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiresInMs(env.JWT_ACCESS_EXPIRES_IN),
  }
}

function toAuthUser(
  user: {
    id: string
    tenantId: string
    firstName: string
    lastName: string
    email: string
    mobile: string | null
    designation: string | null
    department: string | null
    status: string
    emailVerified: boolean
    lastLoginAt: Date | null
  },
  { roles, permissions }: UserPermissions,
): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    designation: user.designation,
    department: user.department,
    status: user.status,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    roles,
    permissions,
  }
}

async function recordLoginActivity(input: {
  tenantId?: string | null
  userId?: string | null
  email: string
  success: boolean
  reason: LoginActivityReason
  ipAddress?: string | null
  userAgent?: string | null
}) {
  await prisma.loginActivity.create({
    data: {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      email: input.email,
      success: input.success,
      reason: input.reason,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

function isLocked(lockedUntil: Date | null | undefined): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > Date.now())
}

async function recordFailedLogin(
  userId: string,
  tenantId: string,
  previousAttempts: number,
  previousCount: number,
  maxFailedLogins: number,
): Promise<{ locked: boolean }> {
  const nextAttempts = previousAttempts + 1
  const nextCount = previousCount + 1
  const data: {
    failedLoginAttempts: number
    failedLoginCount: number
    lockedUntil?: Date
    status?: 'BLOCKED'
    lockedAt?: Date
  } = {
    failedLoginAttempts: nextAttempts,
    failedLoginCount: nextCount,
  }
  if (nextAttempts >= LOGIN_LOCKOUT_THRESHOLD) {
    data.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS)
  }
  if (nextCount >= maxFailedLogins) {
    data.status = 'BLOCKED'
    data.lockedAt = new Date()
    await prisma.refreshToken.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  await prisma.user.update({ where: { id: userId }, data })
  return {
    locked: nextAttempts >= LOGIN_LOCKOUT_THRESHOLD || nextCount >= maxFailedLogins,
  }
}

export async function login(
  input: LoginInput,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
): Promise<LoginResult> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, deletedAt: null, status: { not: 'ARCHIVED' } },
  })

  if (!tenant) {
    await recordLoginActivity({
      email: input.email,
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    throw new AuthenticationError(AUTH_MSG.INVALID_CREDENTIALS, AUTH_CODE.INVALID_CREDENTIALS)
  }

  if (tenant.status === 'SUSPENDED' || tenant.status === 'INACTIVE') {
    await recordLoginActivity({
      tenantId: tenant.id,
      email: input.email,
      success: false,
      reason: 'INVALID_CREDENTIALS',
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    throw new AuthenticationError(AUTH_MSG.TENANT_SUSPENDED, AUTH_CODE.TENANT_SUSPENDED)
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, deletedAt: null },
    select: userSelect,
  })

  const fail = async (reason: LoginActivityReason, userId?: string | null): Promise<never> => {
    await recordLoginActivity({
      tenantId: tenant.id,
      userId: userId ?? user?.id ?? null,
      email: input.email,
      success: false,
      reason,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    })
    if (reason === 'BLOCKED' || reason === 'LOCKED_OUT') {
      throw new AuthenticationError(AUTH_MSG.ACCOUNT_LOCKED, AUTH_CODE.ACCOUNT_LOCKED)
    }
    if (reason === 'INACTIVE') {
      throw new AuthenticationError(AUTH_MSG.ACCOUNT_INACTIVE, AUTH_CODE.ACCOUNT_INACTIVE)
    }
    throw new AuthenticationError(AUTH_MSG.INVALID_CREDENTIALS, AUTH_CODE.INVALID_CREDENTIALS)
  }

  if (!user) {
    return await fail('INVALID_CREDENTIALS')
  }

  if (isLocked(user.lockedUntil) || user.status === 'BLOCKED') {
    return await fail(user.status === 'BLOCKED' ? 'BLOCKED' : 'LOCKED_OUT', user.id)
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash)
  if (!passwordOk) {
    const policy = await getSecurityPolicy(tenant.id)
    const { locked } = await recordFailedLogin(
      user.id,
      tenant.id,
      user.failedLoginAttempts,
      user.failedLoginCount,
      policy.maxFailedLogins || MAX_FAILED_LOGINS,
    )
    if (locked) {
      return await fail('LOCKED_OUT', user.id)
    }
    return await fail('INVALID_CREDENTIALS', user.id)
  }

  if (user.status !== 'ACTIVE') {
    return await fail('INACTIVE', user.id)
  }

  const userPermissions = await loadUserPermissions(user.id, tenant.id)
  const tokens = await issueTokens(user.id, tenant.id, meta?.userAgent, meta?.ipAddress)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      failedLoginCount: 0,
      lockedAt: null,
    },
  })

  await recordLoginActivity({
    tenantId: tenant.id,
    userId: user.id,
    email: input.email,
    success: true,
    reason: 'SUCCESS',
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  const {
    passwordHash: _,
    failedLoginAttempts: _a,
    lockedUntil: _l,
    failedLoginCount: __,
    lockedAt: ___,
    ...safeUser
  } = user

  return {
    ...tokens,
    user: toAuthUser({ ...safeUser, lastLoginAt: new Date() }, userPermissions),
  }
}

export async function refresh(
  input: RefreshTokenInput,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
): Promise<AuthTokens> {
  let payload
  try {
    payload = verifyRefreshToken(input.refreshToken)
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token')
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      id: payload.jti,
      userId: payload.sub,
      tenantId: payload.tenantId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!storedToken || !(await verifyTokenHash(input.refreshToken, storedToken.tokenHash))) {
    throw new AuthenticationError('Invalid or expired refresh token')
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  })

  return issueTokens(payload.sub, payload.tenantId, meta?.userAgent, meta?.ipAddress)
}

export async function logout(userId: string, tenantId: string, input: LogoutInput): Promise<void> {
  if (input.refreshToken) {
    let payload
    try {
      payload = verifyRefreshToken(input.refreshToken)
    } catch {
      throw new AuthenticationError('Invalid refresh token')
    }

    if (payload.sub !== userId || payload.tenantId !== tenantId) {
      throw new AuthenticationError('Invalid refresh token')
    }

    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return
  }

  await prisma.refreshToken.updateMany({
    where: { userId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export interface CompanyBankDetails {
  accountName: string | null
  bankName: string
  accountNumber: string | null
  ifscCode: string | null
  branch: string | null
}

export interface CompanyProfile {
  legalName: string
  tradeName: string | null
  gstin: string | null
  pan: string | null
  address: string | null
  email: string | null
  phone: string | null
  website: string | null
  bank: CompanyBankDetails | null
}

/** Renders a legal entity's registeredAddressJson into print-friendly lines. */
function formatLegalEntityAddress(json: unknown): string | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const a = json as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  const cityLine = [str(a.city), str(a.state), str(a.postalCode)].filter(Boolean).join(' ')
  const lines = [str(a.line1), str(a.line2), cityLine, str(a.country)].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Resolves the print/letterhead company profile from the tenant's default legal entity.
 * Data-driven — never branch on tenant slug; callers should fall back to a static
 * demo profile (keyed by businessType) when this returns null (e.g. no legal entity set up yet).
 */
export async function getCompanyProfile(tenantId: string): Promise<CompanyProfile | null> {
  const legalEntity = await prisma.legalEntity.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: {
      legalName: true,
      tradeName: true,
      displayName: true,
      gstin: true,
      pan: true,
      registeredAddressJson: true,
      email: true,
      phone: true,
      website: true,
      bankAccountName: true,
      bankName: true,
      bankAccountNumber: true,
      bankIfscCode: true,
      bankBranch: true,
    },
  })
  if (!legalEntity) return null

  return {
    legalName: legalEntity.legalName,
    tradeName: legalEntity.tradeName ?? legalEntity.displayName ?? null,
    gstin: legalEntity.gstin,
    pan: legalEntity.pan,
    address: formatLegalEntityAddress(legalEntity.registeredAddressJson),
    email: legalEntity.email,
    phone: legalEntity.phone,
    website: legalEntity.website,
    bank: legalEntity.bankName
      ? {
          accountName: legalEntity.bankAccountName,
          bankName: legalEntity.bankName,
          accountNumber: legalEntity.bankAccountNumber,
          ifscCode: legalEntity.bankIfscCode,
          branch: legalEntity.bankBranch,
        }
      : null,
  }
}

export async function getMe(userId: string, tenantId: string): Promise<
  AuthUser & {
    tenant: {
      id: string
      name: string
      slug: string
      businessType: string
      displayTerminology: Record<string, string>
      companyProfile: CompanyProfile | null
    }
  }
> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: {
      ...userSelect,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          displayTerminology: true,
        },
      },
    },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  const userPermissions = await loadUserPermissions(userId, tenantId)
  const { passwordHash: _, failedLoginAttempts: _a, lockedUntil: _l, tenant, ...safeUser } = user
  const terminology =
    tenant.displayTerminology && typeof tenant.displayTerminology === 'object' && !Array.isArray(tenant.displayTerminology)
      ? (tenant.displayTerminology as Record<string, string>)
      : {}
  const companyProfile = await getCompanyProfile(tenantId)

  return {
    ...toAuthUser(safeUser, userPermissions),
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      businessType: tenant.businessType,
      displayTerminology: terminology,
      companyProfile,
    },
  }
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string; resetToken?: string; emailSent?: boolean }> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, deletedAt: null },
  })

  if (!tenant) {
    return { message: AUTH_MSG.RESET_GENERIC }
  }

  if (tenant.status === 'SUSPENDED' || tenant.status === 'INACTIVE' || tenant.status === 'ARCHIVED') {
    return { message: AUTH_MSG.RESET_GENERIC }
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, deletedAt: null, status: 'ACTIVE' },
  })

  if (!user) {
    return { message: AUTH_MSG.RESET_GENERIC }
  }

  const rawToken = uuidv4()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  const mail = await sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    rawToken,
    expiresAt,
  })

  const result: { message: string; resetToken?: string; emailSent?: boolean } = {
    message: AUTH_MSG.RESET_GENERIC,
    emailSent: mail.sent,
  }

  // Expose token in dev, or when SMTP is not configured so UAT can complete reset without mail.
  if (env.isDev || !isMailConfigured() || !mail.sent) {
    result.resetToken = rawToken
  }

  return result
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const candidates = await prisma.passwordResetToken.findMany({
    where: {
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  let matched: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    if (await verifyTokenHash(input.token, candidate.tokenHash)) {
      matched = candidate
      break
    }
  }

  if (!matched || matched.user.deletedAt || matched.user.status !== 'ACTIVE') {
    throw new InvalidStateError(AUTH_MSG.RESET_TOKEN_INVALID)
  }

  await assertPasswordMeetsPolicy(matched.user.tenantId, input.password)

  const passwordHash = await hashPassword(input.password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: matched.userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        failedLoginCount: 0,
        lockedAt: null,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: matched.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: matched.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<void> {
  const { acceptInvitationByToken } = await import('../users/user-invitation.service.js')
  await acceptInvitationByToken(input.token, input.password)
}

export async function changePassword(
  userId: string,
  tenantId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: { id: true, passwordHash: true, status: true },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  if (user.status !== 'ACTIVE') {
    throw new InvalidStateError(AUTH_MSG.ACCOUNT_INACTIVE)
  }

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthenticationError(AUTH_MSG.CURRENT_PASSWORD_INCORRECT, AUTH_CODE.CURRENT_PASSWORD_INCORRECT)
  }

  await assertPasswordMeetsPolicy(tenantId, input.newPassword)

  const passwordHash = await hashPassword(input.newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        failedLoginCount: 0,
        lockedAt: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}

export async function updateProfile(
  userId: string,
  tenantId: string,
  input: UpdateProfileInput,
): Promise<AuthUser & { tenant: { id: string; name: string; slug: string } }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: { id: true, status: true },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  if (user.status !== 'ACTIVE') {
    throw new InvalidStateError('Account is not active')
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      mobile: input.mobile,
      designation: input.designation,
      updatedBy: userId,
    },
  })

  return getMe(userId, tenantId)
}

export interface LoginDirectoryUser {
  id: string
  email: string
  firstName: string
  lastName: string
  designation: string | null
  department: string | null
  status: string
  roles: string[]
}

/**
 * Dev/test helper for the login page — lists non-deleted users for a tenant.
 * Never returns password hashes or tokens.
 */
export async function listLoginDirectory(query: LoginDirectoryQuery): Promise<{
  tenantSlug: string
  tenantName: string
  users: LoginDirectoryUser[]
}> {
  if (!env.isDev && !env.isTest) {
    throw new AuthorizationError('Login directory is only available in development')
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: query.tenantSlug, deletedAt: null, status: { not: 'ARCHIVED' } },
    select: { id: true, slug: true, name: true },
  })

  if (!tenant) {
    throw new NotFoundError('Tenant not found')
  }

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: [{ status: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      designation: true,
      department: true,
      status: true,
      userRoles: {
        where: { role: { deletedAt: null } },
        select: { role: { select: { name: true } } },
      },
    },
  })

  return {
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      designation: u.designation,
      department: u.department,
      status: u.status,
      roles: u.userRoles.map((ur) => ur.role.name),
    })),
  }
}
