import type { Prisma } from '@prisma/client'
import { prisma } from '../config/database.js'
import { buildPaginationMeta, getPagination, type PaginationInput } from '../utils/pagination.js'

export interface AuditInput {
  tenantId?: string | null
  userId?: string | null
  module: string
  entity: string
  entityId?: string | null
  action: string
  oldValues?: unknown
  newValues?: unknown
  ipAddress?: string | null
  userAgent?: string | null
}

export async function createAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      module: input.module,
      entity: input.entity,
      entityId: input.entityId ?? null,
      action: input.action,
      oldValues: input.oldValues as Prisma.InputJsonValue | undefined,
      newValues: input.newValues as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

export function auditFromRequest(req: {
  context?: { userId: string; tenantId: string }
  ip?: string
  headers?: Record<string, unknown>
}) {
  return {
    tenantId: req.context?.tenantId,
    userId: req.context?.userId,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers?.['user-agent'] as string | undefined) ?? null,
  }
}

export type ListAuditLogsQuery = PaginationInput & {
  module?: string
  entity?: string
  action?: string
  from?: string
  to?: string
  /** Comma-separated module allow-list when `module` is not set */
  modules?: string
}

export async function listAuditLogs(tenantId: string, query: ListAuditLogsQuery) {
  const { skip, take } = getPagination(query)

  const moduleFilter = query.module
    ? query.module
    : query.modules
      ? query.modules
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      : undefined

  const where: Prisma.AuditLogWhereInput = {
    tenantId,
    ...(typeof moduleFilter === 'string'
      ? { module: moduleFilter }
      : Array.isArray(moduleFilter) && moduleFilter.length
        ? { module: { in: moduleFilter } }
        : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...((query.from || query.to) && {
      createdAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      },
    }),
  }

  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ])

  const userIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => Boolean(id)))]
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds }, tenantId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : []
  const userMap = new Map(users.map((u) => [u.id, u]))

  return {
    items: rows.map((row) => {
      const user = row.userId ? userMap.get(row.userId) : null
      return {
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        module: row.module,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        user: user
          ? {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`.trim(),
              email: user.email,
            }
          : null,
      }
    }),
    meta: buildPaginationMeta(total, query.page, query.limit),
  }
}
