import { prisma } from '../../config/database.js'

export interface RoleSummary {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  isSystem: boolean
  permissionCount: number
}

export async function listRolesForTenant(tenantId: string): Promise<RoleSummary[]> {
  const roles = await prisma.role.findMany({
    where: {
      deletedAt: null,
      OR: [{ tenantId }, { tenantId: null }],
    },
    include: {
      _count: { select: { rolePermissions: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { name: 'asc' }],
  })

  return roles.map((role) => ({
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionCount: role._count.rolePermissions,
  }))
}
