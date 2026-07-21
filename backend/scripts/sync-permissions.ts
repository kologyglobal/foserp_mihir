/**
 * Backfill the permission catalog and role→permission links on an existing database.
 *
 * Safe for production: idempotent upserts only — never touches users, tenants,
 * business data, or removes existing grants. Run after deploying a build that
 * added new permissions (e.g. crm.quotation.convert) so already-seeded roles
 * like Tenant Admin / Sales Manager pick them up.
 *
 * Usage (from backend/):
 *   npx tsx scripts/sync-permissions.ts            # apply
 *   npx tsx scripts/sync-permissions.ts --dry-run  # report only
 *
 * Users must log out and back in afterwards — session permissions are issued at login.
 */
import { prisma } from '../src/config/database.js'
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/constants/permissions.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const existing = await prisma.permission.findMany({ select: { id: true, name: true } })
  const permissionIdByName = new Map(existing.map((p) => [p.name, p.id]))

  const missingCatalog = PERMISSIONS.filter((name) => !permissionIdByName.has(name))
  console.log(`Permission catalog: ${existing.length} in DB, ${PERMISSIONS.length} in code, ${missingCatalog.length} missing`)
  for (const name of missingCatalog) {
    console.log(`  + permission ${name}`)
    if (dryRun) continue
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    permissionIdByName.set(name, perm.id)
  }

  const roles = await prisma.role.findMany({
    where: { name: { in: Object.keys(ROLE_PERMISSIONS) }, deletedAt: null },
    include: { rolePermissions: { select: { permissionId: true } } },
  })
  console.log(`\nRoles found in DB: ${roles.length} (of ${Object.keys(ROLE_PERMISSIONS).length} known role names)`)

  let totalLinked = 0
  for (const role of roles) {
    const granted = new Set(role.rolePermissions.map((rp) => rp.permissionId))
    const wanted = ROLE_PERMISSIONS[role.name] ?? []
    const missing = wanted.filter((name) => {
      const id = permissionIdByName.get(name)
      return id !== undefined && !granted.has(id)
    })
    const scope = role.tenantId ? `tenant ${role.tenantId}` : 'system'
    console.log(`  ${role.name} (${scope}): ${granted.size} granted, ${missing.length} to add`)
    for (const name of missing) {
      const permissionId = permissionIdByName.get(name)!
      console.log(`    + ${name}`)
      totalLinked += 1
      if (dryRun) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        create: { roleId: role.id, permissionId },
        update: {},
      })
    }
  }

  console.log(
    dryRun
      ? `\nDry run: would create ${missingCatalog.length} permissions and ${totalLinked} role links.`
      : `\nDone: created ${missingCatalog.length} permissions and ${totalLinked} role links.`,
  )
  if (!dryRun && (missingCatalog.length > 0 || totalLinked > 0)) {
    console.log('Users must log out and log in again to receive the updated permissions.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
