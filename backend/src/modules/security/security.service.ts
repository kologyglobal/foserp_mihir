import { prisma } from '../../config/database.js'
import { createAuditLog } from '../../services/audit.service.js'
import { InvalidStateError, NotFoundError } from '../../utils/errors.js'
import { buildPaginationMeta, getPagination } from '../../utils/pagination.js'
import { sanitizeUser } from '../users/user.service.js'
import * as userRepository from '../users/user.repository.js'
import { revokeUserSessions } from '../users/user-invitation.service.js'
import { MAX_FAILED_LOGINS } from './security.constants.js'
import type { ListLoginActivityQuery, ListSessionsQuery } from './security.validation.js'

interface AuditMeta {
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export async function listLoginActivity(tenantId: string, query: ListLoginActivityQuery) {
  const { skip, take } = getPagination(query)
  const where = {
    tenantId,
    ...(query.success === 'true' ? { success: true } : query.success === 'false' ? { success: false } : {}),
    ...(query.email ? { email: { contains: query.email } } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.loginActivity.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, status: true } },
      },
    }),
    prisma.loginActivity.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      email: row.email,
      success: row.success,
      reason: row.reason,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      user: row.user
        ? {
            id: row.user.id,
            name: `${row.user.firstName} ${row.user.lastName}`.trim(),
            status: row.user.status,
          }
        : null,
    })),
    meta: buildPaginationMeta(total, query.page, query.limit),
    policy: { maxFailedLogins: MAX_FAILED_LOGINS },
  }
}

export async function listActiveSessions(tenantId: string, query: ListSessionsQuery) {
  const { skip, take } = getPagination(query)
  const where = {
    tenantId,
    revokedAt: null,
    expiresAt: { gt: new Date() },
    ...(query.userId ? { userId: query.userId } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.refreshToken.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      },
    }),
    prisma.refreshToken.count({ where }),
  ])

  return {
    items: items.map((row) => ({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      user: {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`.trim(),
        email: row.user.email,
        status: row.user.status,
      },
    })),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}

export async function revokeSession(tenantId: string, sessionId: string, audit?: AuditMeta) {
  const session = await prisma.refreshToken.findFirst({
    where: { id: sessionId, tenantId, revokedAt: null },
  })
  if (!session) throw new NotFoundError('Session not found')

  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'security',
    entity: 'RefreshToken',
    entityId: sessionId,
    action: 'REVOKE',
    oldValues: { userId: session.userId },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { id: sessionId, revoked: true }
}

export async function listLockedAccounts(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null, status: 'BLOCKED' },
    orderBy: { lockedAt: 'desc' },
    include: {
      userRoles: {
        include: { role: { select: { id: true, name: true, description: true, isSystem: true } } },
      },
    },
  })

  return {
    items: users.map((u) => ({
      ...sanitizeUser(u),
      failedLoginCount: u.failedLoginCount,
      lockedAt: u.lockedAt,
    })),
    policy: { maxFailedLogins: MAX_FAILED_LOGINS },
  }
}

export async function lockUser(tenantId: string, userId: string, audit?: AuditMeta) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) throw new NotFoundError('User not found')
  if (existing.status === 'ARCHIVED') throw new InvalidStateError('Archived users cannot be locked')
  if (existing.status === 'BLOCKED') {
    return { user: sanitizeUser(existing), revokedSessions: 0 }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: 'BLOCKED', lockedAt: new Date(), updatedBy: audit?.userId },
    include: {
      userRoles: {
        include: { role: { select: { id: true, name: true, description: true, isSystem: true } } },
      },
    },
  })
  const revokedSessions = await revokeUserSessions(userId, tenantId)
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'security',
    entity: 'User',
    entityId: userId,
    action: 'LOCK',
    oldValues: sanitizeUser(existing),
    newValues: { ...safeUser, revokedSessions },
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return { user: safeUser, revokedSessions }
}

export async function unlockUser(tenantId: string, userId: string, audit?: AuditMeta) {
  const existing = await userRepository.findUserById(tenantId, userId)
  if (!existing) throw new NotFoundError('User not found')
  if (existing.status === 'ARCHIVED') throw new InvalidStateError('Archived users cannot be unlocked')
  if (existing.status !== 'BLOCKED') {
    throw new InvalidStateError('Only blocked accounts can be unlocked')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedAt: null,
      updatedBy: audit?.userId,
    },
    include: {
      userRoles: {
        include: { role: { select: { id: true, name: true, description: true, isSystem: true } } },
      },
    },
  })
  const safeUser = sanitizeUser(user)

  await createAuditLog({
    tenantId,
    userId: audit?.userId ?? null,
    module: 'security',
    entity: 'User',
    entityId: userId,
    action: 'UNLOCK',
    oldValues: sanitizeUser(existing),
    newValues: safeUser,
    ipAddress: audit?.ipAddress,
    userAgent: audit?.userAgent,
  })

  return safeUser
}
