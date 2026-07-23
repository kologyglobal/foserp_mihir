import { randomBytes } from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { createAuditLog } from '../../services/audit.service.js'
import { ConflictError, InvalidStateError, NotFoundError } from '../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import { hashPassword, hashToken, verifyTokenHash } from '../../utils/password.js'
import * as userRepository from './user.repository.js'
import type { UserWithRoles } from './user.repository.js'
import type { InviteUserInput, ListInvitationsQuery } from './user.validation.js'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function sanitizeUser(user: UserWithRoles) {
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
    createdBy: user.createdBy,
    updatedBy: user.updatedBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      isSystem: ur.role.isSystem,
    })),
  }
}
export type InvitationStatus = 'open' | 'accepted' | 'revoked' | 'expired'

export interface SafeInvitation {
  id: string
  tenantId: string
  userId: string
  email: string
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  invitedBy: string | null
  createdAt: Date
  status: InvitationStatus
  user: { id: string; firstName: string; lastName: string; status: string }
}

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

function invitationStatus(row: {
  acceptedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
}): InvitationStatus {
  if (row.acceptedAt) return 'accepted'
  if (row.revokedAt) return 'revoked'
  if (row.expiresAt.getTime() <= Date.now()) return 'expired'
  return 'open'
}

async function issueInvitationToken(userId: string, tenantId: string, email: string, invitedBy?: string) {
  await prisma.userInvitation.updateMany({
    where: { userId, tenantId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const rawToken = uuidv4()
  const tokenHash = await hashToken(rawToken)
  const invitation = await prisma.userInvitation.create({
    data: {
      tenantId,
      userId,
      email,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedBy,
    },
  })

  return { invitation, rawToken }
}

export async function revokeUserSessions(userId: string, tenantId: string) {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, tenantId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

export async function inviteUser(
  tenantId: string,
  input: InviteUserInput,
  audit?: AuditMeta,
): Promise<{ user: ReturnType<typeof sanitizeUser>; invitation: SafeInvitation; inviteToken?: string }> {
  const existing = await userRepository.findUserByEmail(tenantId, input.email)
  if (existing) {
    throw new ConflictError('User with this email already exists')
  }

  if (input.roleIds?.length) {
    for (const roleId of input.roleIds) {
      const role = await userRepository.findRoleInTenant(tenantId, roleId)
      if (!role) {
        throw new NotFoundError(`Role not found: ${roleId}`)
      }
    }
  }

  const placeholderPassword = `inv-${randomBytes(24).toString('hex')}`
  const passwordHash = await hashPassword(placeholderPassword)
  const user = await userRepository.createUser(
    tenantId,
    {
      ...input,
      password: placeholderPassword,
      status: 'INVITED',
    },
    passwordHash,
    audit?.userId,
  )

  const { invitation, rawToken } = await issueInvitationToken(user.id, tenantId, user.email, audit?.userId)
  const safeUser = sanitizeUser(user)
  const safeInvitation: SafeInvitation = {
    id: invitation.id,
    tenantId: invitation.tenantId,
    userId: invitation.userId,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    status: 'open',
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    },
  }

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'UserInvitation',
    entityId: invitation.id,
    action: 'INVITE',
    newValues: { userId: user.id, email: user.email, invitationId: invitation.id },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    user: safeUser,
    invitation: safeInvitation,
    ...(env.isDev || env.isTest ? { inviteToken: rawToken } : {}),
  }
}

export async function resendInvitation(
  tenantId: string,
  userId: string,
  audit?: AuditMeta,
): Promise<{ invitation: SafeInvitation; inviteToken?: string }> {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }
  if (user.status !== 'INVITED') {
    throw new InvalidStateError('Only invited users can receive a new invitation')
  }

  const { invitation, rawToken } = await issueInvitationToken(user.id, tenantId, user.email, audit?.userId)
  const safeInvitation: SafeInvitation = {
    id: invitation.id,
    tenantId: invitation.tenantId,
    userId: invitation.userId,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    status: 'open',
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    },
  }

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'UserInvitation',
    entityId: invitation.id,
    action: 'RESEND_INVITE',
    newValues: { userId, invitationId: invitation.id },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return {
    invitation: safeInvitation,
    ...(env.isDev || env.isTest ? { inviteToken: rawToken } : {}),
  }
}

export async function listInvitations(tenantId: string, query: ListInvitationsQuery) {
  const { skip, take } = getPagination(query)
  const now = new Date()
  const where = {
    tenantId,
    ...(query.status === 'accepted'
      ? { acceptedAt: { not: null } }
      : query.status === 'revoked'
        ? { revokedAt: { not: null }, acceptedAt: null }
        : query.status === 'expired'
          ? { acceptedAt: null, revokedAt: null, expiresAt: { lte: now } }
          : query.status === 'open'
            ? { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }
            : query.status === 'pending'
              ? { acceptedAt: null, revokedAt: null }
              : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.userInvitation.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, status: true } },
      },
    }),
    prisma.userInvitation.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      email: row.email,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      invitedBy: row.invitedBy,
      createdAt: row.createdAt,
      status: invitationStatus(row),
      user: row.user,
    })),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function deactivateUser(tenantId: string, userId: string, audit?: AuditMeta) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) {
    throw new NotFoundError('User not found')
  }
  if (existing.status === 'ARCHIVED') {
    throw new InvalidStateError('Archived users cannot be deactivated')
  }
  if (existing.status === 'INACTIVE') {
    return { user: sanitizeUser(existing), revokedSessions: 0 }
  }

  const user = await userRepository.updateUser(tenantId, userId, { status: 'INACTIVE' }, audit?.userId)
  const revokedSessions = await revokeUserSessions(userId, tenantId)
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'User',
    entityId: userId,
    action: 'DEACTIVATE',
    oldValues: sanitizeUser(existing),
    newValues: { ...safeUser, revokedSessions },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { user: safeUser, revokedSessions }
}

export async function activateUser(tenantId: string, userId: string, audit?: AuditMeta) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) {
    throw new NotFoundError('User not found')
  }
  if (existing.status === 'ARCHIVED') {
    throw new InvalidStateError('Archived users cannot be activated')
  }
  if (existing.status === 'INVITED') {
    throw new InvalidStateError('Invited users must accept their invitation before activation')
  }

  const user = await userRepository.updateUser(tenantId, userId, { status: 'ACTIVE' }, audit?.userId)
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'User',
    entityId: userId,
    action: 'ACTIVATE',
    oldValues: sanitizeUser(existing),
    newValues: safeUser,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}

export async function listUserSessions(tenantId: string, userId: string) {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }

  return prisma.refreshToken.findMany({
    where: { userId, tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      userAgent: true,
      ipAddress: true,
    },
  })
}

export async function revokeUserSessionsAdmin(tenantId: string, userId: string, audit?: AuditMeta) {
  const user = await userRepository.findUserById(tenantId, userId)
  if (!user) {
    throw new NotFoundError('User not found')
  }

  const revokedSessions = await revokeUserSessions(userId, tenantId)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'user',
    entity: 'UserSession',
    entityId: userId,
    action: 'REVOKE_SESSIONS',
    newValues: { userId, revokedSessions },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { revokedSessions }
}

export async function acceptInvitationByToken(token: string, password: string): Promise<void> {
  const candidates = await prisma.userInvitation.findMany({
    where: {
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  let matched: (typeof candidates)[number] | null = null
  for (const candidate of candidates) {
    if (await verifyTokenHash(token, candidate.tokenHash)) {
      matched = candidate
      break
    }
  }

  if (!matched || matched.user.deletedAt) {
    throw new InvalidStateError('Invalid or expired invitation')
  }
  if (matched.user.status !== 'INVITED') {
    throw new InvalidStateError('Invitation is no longer valid for this user')
  }

  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: matched.userId },
      data: {
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
      },
    }),
    prisma.userInvitation.update({
      where: { id: matched.id },
      data: { acceptedAt: new Date() },
    }),
    prisma.userInvitation.updateMany({
      where: {
        userId: matched.userId,
        id: { not: matched.id },
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: matched.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}
