/**
 * One-off: ensure Delivery Time master rows exist for every active tenant.
 * Usage: npx tsx scripts/seed-delivery-time-master.ts
 */
import { prisma } from '../src/config/prisma.js'
import { CRM_MASTER_SEED_ROWS } from '../src/modules/crm/masters/crm-master.seed-data.js'
import { ensureSeedRows } from '../src/modules/crm/masters/crm-master.repository.js'

async function main() {
  const rows = CRM_MASTER_SEED_ROWS.filter((r) => r.kind === 'delivery-time')
  if (rows.length === 0) {
    throw new Error('No delivery-time rows in CRM_MASTER_SEED_ROWS')
  }

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
  })

  if (tenants.length === 0) {
    console.log('No tenants found — nothing to seed.')
    return
  }

  for (const tenant of tenants) {
    await ensureSeedRows(tenant.id, null, rows)
    const count = await prisma.crmMaster.count({
      where: { tenantId: tenant.id, kind: 'delivery-time', deletedAt: null },
    })
    console.log(`✓ ${tenant.slug} (${tenant.name}): ${count} delivery-time rows`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
