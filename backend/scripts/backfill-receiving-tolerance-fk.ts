/**
 * Backfill master_items.receivingToleranceId from legacy receivingTolerancePercentage.
 * Run after receiving tolerance master migration + seed (EXACT/STD10/BULK20).
 *
 * Usage: npx tsx scripts/backfill-receiving-tolerance-fk.ts
 */
import { prisma } from '../src/config/prisma.js'

function legacyCode(pct: number): string {
  const normalized = Number(pct.toFixed(4))
  if (normalized === 0) return 'EXACT'
  if (normalized === 10) return 'STD10'
  if (normalized === 20) return 'BULK20'
  return `LEGACY-${normalized}`
}

async function main() {
  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, select: { id: true, slug: true } })
  for (const tenant of tenants) {
    const systemRows = await prisma.masterReceivingTolerance.findMany({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { id: true, code: true, percentage: true },
    })
    const idByCode = new Map(systemRows.map((r) => [r.code, r.id]))

    const legacyPcts = await prisma.masterItem.findMany({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        receivingToleranceId: null,
        receivingTolerancePercentage: { gt: 0 },
      },
      select: { receivingTolerancePercentage: true },
      distinct: ['receivingTolerancePercentage'],
    })

    for (const row of legacyPcts) {
      const pct = Number(row.receivingTolerancePercentage)
      const code = legacyCode(pct)
      if (idByCode.has(code)) continue
      const created = await prisma.masterReceivingTolerance.create({
        data: {
          tenantId: tenant.id,
          code,
          name: `Legacy ${pct}%`,
          description: `Auto-created from legacy item tolerance ${pct}%`,
          percentage: pct,
          isSystem: false,
          status: 'ACTIVE',
        },
      })
      idByCode.set(code, created.id)
    }

    const items = await prisma.masterItem.findMany({
      where: { tenantId: tenant.id, deletedAt: null, receivingToleranceId: null },
      select: { id: true, receivingTolerancePercentage: true },
    })

    let updated = 0
    for (const item of items) {
      const pct = Number(item.receivingTolerancePercentage ?? 0)
      if (pct <= 0) continue
      const code = legacyCode(pct)
      const tolId = idByCode.get(code)
      if (!tolId) continue
      await prisma.masterItem.update({
        where: { id: item.id },
        data: { receivingToleranceId: tolId },
      })
      updated += 1
    }

    console.log(`[${tenant.slug}] backfilled ${updated} item(s)`)
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
