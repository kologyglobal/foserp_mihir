import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import {
  AuthenticationError,
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
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  ResetPasswordInput,
} from './auth.validation.js'

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
  passwordHash: true,
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

export async function login(
  input: LoginInput,
  meta?: { userAgent?: string | null; ipAddress?: string | null },
): Promise<LoginResult> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, deletedAt: null, status: { not: 'ARCHIVED' } },
  })

  if (!tenant) {
    throw new AuthenticationError('Invalid tenant, email, or password')
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, deletedAt: null },
    select: userSelect,
  })

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AuthenticationError('Invalid tenant, email, or password')
  }

  if (user.status !== 'ACTIVE') {
    throw new AuthenticationError('Account is not active')
  }

  const userPermissions = await loadUserPermissions(user.id, tenant.id)
  const tokens = await issueTokens(user.id, tenant.id, meta?.userAgent, meta?.ipAddress)

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const { passwordHash: _, ...safeUser } = user

  return {
    ...tokens,
    user: toAuthUser(safeUser, userPermissions),
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

export async function getMe(userId: string, tenantId: string): Promise<AuthUser & { tenant: { id: string; name: string; slug: string } }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: {
      ...userSelect,
      tenant: { select: { id: true, name: true, slug: true } },
    },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  const userPermissions = await loadUserPermissions(userId, tenantId)
  const { passwordHash: _, tenant, ...safeUser } = user

  return {
    ...toAuthUser(safeUser, userPermissions),
    tenant,
  }
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string; resetToken?: string }> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, deletedAt: null },
  })

  if (!tenant) {
    return { message: 'If the account exists, a password reset link has been sent' }
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: input.email, deletedAt: null, status: 'ACTIVE' },
  })

  if (!user) {
    return { message: 'If the account exists, a password reset link has been sent' }
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

  const result: { message: string; resetToken?: string } = {
    message: 'If the account exists, a password reset link has been sent',
  }

  if (env.isDev) {
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
    throw new InvalidStateError('Invalid or expired reset token')
  }

  const passwordHash = await hashPassword(input.password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: matched.userId },
      data: { passwordHash },
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
    throw new InvalidStateError('Account is not active')
  }

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthenticationError('Current password is incorrect')
  }

  const passwordHash = await hashPassword(input.newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}
