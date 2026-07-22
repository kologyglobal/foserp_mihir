/**
 * One-shot: upsert gate.* permission catalog rows and link them to seeded roles.
 */
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'

async function main() {
  const gatePerms = PERMISSIONS.filter((p) => p.startsWith('gate.'))
  for (const name of gatePerms) {
    const [module] = name.split('.')
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
  }

  const allPerms = await prisma.permission.findMany({ where: { name: { startsWith: 'gate.' } } })
  const idByName = new Map(allPerms.map((p) => [p.name, p.id]))

  const roles = await prisma.role.findMany({
    where: { name: { in: Object.keys(ROLE_PERMISSIONS) }, deletedAt: null },
    include: { rolePermissions: true },
  })

  let linked = 0
  for (const role of roles) {
    const wanted = (ROLE_PERMISSIONS[role.name] ?? []).filter((n) => n.startsWith('gate.'))
    const have = new Set(role.rolePermissions.map((rp) => rp.permissionId))
    for (const name of wanted) {
      const permissionId = idByName.get(name)
      if (!permissionId || have.has(permissionId)) continue
      try {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } })
        linked += 1
      } catch {
        // already linked
      }
    }
  }

  console.log(`gate permissions in catalog: ${allPerms.length}; new role links: ${linked}`)
  console.log('Log out and log in again to refresh JWT permissions.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
