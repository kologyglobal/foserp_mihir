import { prisma } from '../src/config/database.js'

const phase4Prefixes = [
  'master.item_category.',
  'master.hsn.',
  'master.gst_group.',
  'master.gst_rate.',
  'master.item.',
  'master.vendor.',
]

async function main() {
  const allMaster = await prisma.permission.findMany({
    where: { name: { startsWith: 'master.' } },
    orderBy: { name: 'asc' },
  })

  const phase4 = allMaster.filter((p) => phase4Prefixes.some((prefix) => p.name.startsWith(prefix)))
  console.log(`Phase 4 master permissions: ${phase4.length} (expected 24)`)
  for (const p of phase4) console.log(`  - ${p.name}`)

  const roles = await prisma.role.findMany({
    where: {
      name: {
        in: ['Master Data Manager', 'Purchase Manager', 'Inventory Manager', 'Production Manager', 'Viewer', 'Tenant Admin'],
      },
    },
    include: { rolePermissions: { include: { permission: true } } },
  })

  console.log('')
  for (const role of roles) {
    const assigned = role.rolePermissions
      .map((rp) => rp.permission.name)
      .filter((name) => phase4Prefixes.some((prefix) => name.startsWith(prefix)))
    console.log(`${role.name}: ${assigned.length} Phase 4 permissions`)
    if (assigned.length > 0 && assigned.length <= 8) {
      assigned.forEach((name) => console.log(`    ${name}`))
    }
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
