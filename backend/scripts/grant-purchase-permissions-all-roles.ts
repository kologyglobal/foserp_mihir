/**
 * Grant every purchase.* permission to every role (all tenants + global roles).
 * Idempotent — safe to re-run. Usage: npx tsx scripts/grant-purchase-permissions-all-roles.ts
 */
import { PERMISSIONS } from '../src/constants/permissions.js'
import { prisma } from '../src/config/database.js'

async function main() {
  const purchaseNames = PERMISSIONS.filter((p) => p.startsWith('purchase.'))
  console.log(`Purchase permission catalog: ${purchaseNames.length} keys`)

  // Ensure all purchase permissions exist in the DB (same upsert shape as prisma/seed.ts)
  const permissionIds: string[] = []
  for (const name of purchaseNames) {
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module: 'purchase', description: name },
      update: {},
    })
    permissionIds.push(perm.id)
  }

  const roles = await prisma.role.findMany({
    select: { id: true, name: true, tenantId: true, tenant: { select: { slug: true } } },
  })
  console.log(`Roles found: ${roles.length}`)

  let granted = 0
  for (const role of roles) {
    const result = await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    })
    granted += result.count
    console.log(
      `  ${role.name} (${role.tenant?.slug ?? 'global'}): +${result.count} new grants`,
    )
  }

  console.log(`\nDone. ${granted} new role-permission grants created.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
