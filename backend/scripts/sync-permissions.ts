/**
 * Idempotent permission sync: upserts every PERMISSIONS entry and re-attaches
 * role grants per ROLE_PERMISSIONS for all existing roles (system + tenant).
 * Safe to run on live databases — never deletes grants.
 *
 * Run: npx tsx scripts/sync-permissions.ts
 */
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'
import { prisma } from '../src/config/database.js'

async function main() {
  const permIdByName = new Map<string, string>()
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    permIdByName.set(name, perm.id)
  }
  console.log(`Permissions upserted: ${permIdByName.size}`)

  const roles = await prisma.role.findMany({ select: { id: true, name: true, tenantId: true } })
  let grants = 0
  for (const role of roles) {
    const wanted = ROLE_PERMISSIONS[role.name]
    if (!wanted) continue
    for (const permName of wanted) {
      const permissionId = permIdByName.get(permName)
      if (!permissionId) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      })
      grants += 1
    }
  }
  console.log(`Role grants ensured: ${grants} across ${roles.length} roles`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
