import type { Prisma } from '@prisma/client'

export async function resolveUserNames(
  userIds: Array<string | null | undefined>,
  tenantId: string,
  db: Prisma.TransactionClient | typeof import('../../config/database.js').prisma,
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return new Map()

  const users = await db.user.findMany({
    where: { tenantId, id: { in: ids }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })

  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]))
}
