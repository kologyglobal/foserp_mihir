import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const phase4Modules = ['item_category', 'hsn', 'gst_group', 'gst_rate', 'item', 'vendor']

async function main() {
  const perms = await prisma.permission.findMany({
    where: {
      OR: phase4Modules.map((m) => ({ name: { startsWith: `master.${m}` } })),
    },
    orderBy: { name: 'asc' },
  })

  console.log(`Phase 4 permissions (${perms.length}/24 expected):`)
  for (const p of perms) console.log(`  ${p.name}`)

  const roles = [
    'Master Data Manager',
    'Purchase Manager',
    'Inventory Manager',
    'Sales Manager',
    'Production Manager',
    'Viewer',
    'Tenant Admin',
  ]

  console.log('\nRole assignments (phase-4 master permissions):')
  for (const roleName of roles) {
    const role = await prisma.role.findFirst({
      where: { name: roleName, tenant: { slug: 'vasant-trailers' } },
    })
    if (!role) {
      console.log(`  ${roleName}: role not found`)
      continue
    }
    const assigned = await prisma.rolePermission.findMany({
      where: {
        roleId: role.id,
        permission: {
          OR: phase4Modules.map((m) => ({ name: { startsWith: `master.${m}` } })),
        },
      },
      include: { permission: true },
    })
    console.log(`  ${roleName}: ${assigned.length} permissions`)
  }
}

main()
  .finally(() => prisma.$disconnect())
