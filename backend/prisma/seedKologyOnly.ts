/**
 * Standalone: seed only the Kology SERVICES tenant (does not re-seed vasant).
 * Usage: npx tsx prisma/seedKologyOnly.ts
 */
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'
import { prisma } from '../src/config/database.js'
import { seedKologyTenant } from './seedKology.js'

async function seedPermissions(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    map.set(name, perm.id)
  }
  return map
}

async function seedRole(
  name: string,
  permissionMap: Map<string, string>,
  tenantId: string | null,
  isSystem: boolean,
): Promise<string> {
  let role = await prisma.role.findFirst({
    where: { name, tenantId: tenantId ?? null },
  })
  if (!role) {
    role = await prisma.role.create({
      data: { name, tenantId, isSystem, description: `${name} role` },
    })
  }
  const permNames = ROLE_PERMISSIONS[name] ?? []
  for (const permName of permNames) {
    const permissionId = permissionMap.get(permName)
    if (!permissionId) continue
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      create: { roleId: role.id, permissionId },
      update: {},
    })
  }
  return role.id
}

async function main() {
  console.log('Seeding Kology SERVICES tenant only...')
  const permissionMap = await seedPermissions()
  await seedRole('Super Admin', permissionMap, null, true)
  await seedKologyTenant(permissionMap, seedRole)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
