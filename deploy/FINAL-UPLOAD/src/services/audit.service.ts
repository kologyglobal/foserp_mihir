import type { Prisma } from '@prisma/client'
import { prisma } from '../config/database.js'

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

export function auditFromRequest(req: { context?: { userId: string; tenantId: string }; ip?: string; headers?: Record<string, unknown> }) {
  return {
    tenantId: req.context?.tenantId,
    userId: req.context?.userId,
    ipAddress: req.ip ?? null,
    userAgent: (req.headers?.['user-agent'] as string | undefined) ?? null,
  }
}
