/**
 * Upsert CRM-only demo user + role for an existing tenant DB.
 * Safe to re-run — idempotent upserts only.
 *
 * Usage: npx tsx scripts/seed-crm-user.ts
 */

import { ROLE_PERMISSIONS } from '../src/constants/permissions.js'
import { prisma } from '../src/config/prisma.js'
import { hashPassword } from '../src/utils/password.js'

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? 'vasant-trailers'
const CRM_USER_EMAIL = process.env.SEED_CRM_USER_EMAIL ?? 'crm.user@vasant-trailers.com'
const CRM_USER_PASSWORD = process.env.SEED_CRM_USER_PASSWORD ?? 'CrmUser@123'

async function seedPermissions(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const permNames = ROLE_PERMISSIONS['CRM User'] ?? []
  for (const name of permNames) {
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

async function main(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) {
    throw new Error(`Tenant not found: ${TENANT_SLUG}. Run prisma/seed.ts first.`)
  }

  const permissionMap = await seedPermissions()

  let role = await prisma.role.findFirst({
    where: { name: 'CRM User', tenantId: tenant.id },
  })
  if (!role) {
    role = await prisma.role.create({
      data: { name: 'CRM User', tenantId: tenant.id, isSystem: true, description: 'CRM User role' },
    })
  }

  const permNames = ROLE_PERMISSIONS['CRM User'] ?? []
  for (const permName of permNames) {
    const permissionId = permissionMap.get(permName)
    if (!permissionId) continue
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      create: { roleId: role.id, permissionId },
      update: {},
    })
  }

  const passwordHash = await hashPassword(CRM_USER_PASSWORD)
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: CRM_USER_EMAIL } },
    create: {
      tenantId: tenant.id,
      firstName: 'CRM',
      lastName: 'User',
      email: CRM_USER_EMAIL,
      mobile: '9876543211',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
      designation: 'Sales Executive',
      department: 'Sales',
    },
    update: {
      passwordHash,
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id, tenantId: tenant.id },
    update: {},
  })

  console.log('CRM User seeded successfully')
  console.log(`  Tenant: ${tenant.slug}`)
  console.log(`  Email: ${CRM_USER_EMAIL}`)
  console.log(`  Password: ${CRM_USER_PASSWORD}`)
  console.log(`  Role: CRM User (${permNames.length} permissions)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
