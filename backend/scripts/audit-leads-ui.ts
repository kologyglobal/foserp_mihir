/**
 * One-off audit: why phpMyAdmin leads may not show in CRM UI.
 * Run: npx tsx scripts/audit-leads-ui.ts
 * Loads DB_* / DATABASE_URL the same way the server does.
 */
import '../src/config/env.js'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  const tenants = await p.tenant.findMany({
    select: { id: true, slug: true, name: true, deletedAt: true, status: true },
  })
  console.log('=== TENANTS ===')
  console.log(JSON.stringify(tenants, null, 2))

  const total = await p.crmLead.count()
  const active = await p.crmLead.count({ where: { deletedAt: null } })
  const softDeleted = await p.crmLead.count({ where: { deletedAt: { not: null } } })
  const archived = await p.crmLead.count({ where: { deletedAt: null, isArchived: true } })
  console.log('=== LEAD COUNTS ===')
  console.log({ total, active, softDeleted, archived })

  const byTenant = await p.crmLead.groupBy({
    by: ['tenantId'],
    _count: { _all: true },
  })
  console.log('=== LEADS BY TENANT ===')
  for (const row of byTenant) {
    const t = tenants.find((x) => x.id === row.tenantId)
    console.log({
      tenantId: row.tenantId,
      slug: t?.slug ?? '(missing tenant)',
      count: row._count._all,
    })
  }

  const sample = await p.crmLead.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      leadCode: true,
      prospectName: true,
      stage: true,
      deletedAt: true,
      isArchived: true,
      companyId: true,
      createdAt: true,
    },
  })
  console.log('=== SAMPLE LEADS ===')
  console.log(JSON.stringify(sample, null, 2))

  const vasant = tenants.find((t) => t.slug === 'vasant-trailers')
  if (vasant) {
    const listLike = await p.crmLead.count({
      where: { tenantId: vasant.id, deletedAt: null, isArchived: false },
    })
    const listLikeInclArchived = await p.crmLead.count({
      where: { tenantId: vasant.id, deletedAt: null },
    })
    console.log('=== VASANT LIST FILTER PREVIEW ===')
    console.log({
      tenantId: vasant.id,
      activeNotArchived: listLike,
      activeIncludingArchived: listLikeInclArchived,
    })
  } else {
    console.log('=== WARNING: tenant slug vasant-trailers not found ===')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await p.$disconnect()
  })
