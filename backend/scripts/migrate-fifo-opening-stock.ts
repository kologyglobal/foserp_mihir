/**
 * FIFO opening-stock migration — seed OPEN cost layers for existing on-hand gaps.
 *
 * Does not change physical stock quantities. Creates synthetic OPENING movements
 * (valuation seed only) + InventoryCostLayer + InventoryCostEntry.
 *
 * Usage:
 *   npx tsx scripts/migrate-fifo-opening-stock.ts --tenant=vasant-trailers --dry-run
 *   npx tsx scripts/migrate-fifo-opening-stock.ts --tenant=vasant-trailers
 *   npx tsx scripts/migrate-fifo-opening-stock.ts --tenant=vasant-trailers --force
 */
import { prisma } from '../src/config/database.js'
import { migrateFifoOpeningStock } from '../src/modules/inventory/costing/fifo-opening-stock-migration.service.js'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main() {
  const dryRun = hasFlag('dry-run')
  const force = hasFlag('force')
  const tenantArg = arg('tenant') ?? process.argv[2] ?? process.env.TENANT_SLUG

  if (!tenantArg) {
    throw new Error('Pass --tenant=<slug|id> (or TENANT_SLUG env)')
  }

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: tenantArg }, { id: tenantArg }], deletedAt: null },
    select: { id: true, slug: true },
  })
  if (!tenant) throw new Error(`Tenant not found: ${tenantArg}`)

  console.log(
    `FIFO opening-stock migration for ${tenant.slug} (${tenant.id}) dryRun=${dryRun} force=${force}`,
  )

  const result = await migrateFifoOpeningStock({
    tenantId: tenant.id,
    dryRun,
    force,
  })

  console.log(
    JSON.stringify(
      {
        tenantId: result.tenantId,
        valuationMethod: result.valuationMethod,
        dryRun: result.dryRun,
        createdLayers: result.createdLayers,
        skipped: result.skipped,
        exceptions: result.exceptions,
        sample: result.rows.slice(0, 20),
      },
      null,
      2,
    ),
  )

  if (result.exceptions > 0) {
    console.error(`Completed with ${result.exceptions} exception(s) — review OVERALLOCATED rows`)
    process.exitCode = 2
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
